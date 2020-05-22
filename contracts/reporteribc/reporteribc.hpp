#pragma once

#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <eosio/singleton.hpp>
#include <eosio/symbol.hpp>
#include <eosio/system.hpp>
#include <eosio/transaction.hpp>

#include "./utils.hpp"

using namespace eosio;
using namespace std;

struct token_info {
  symbol symbol;
  name contract;
};

CONTRACT reporteribc : public contract {
 public:
  using contract::contract;
  reporteribc(eosio::name receiver, eosio::name code,
              eosio::datastream<const char *> ds)
      : contract(receiver, code, ds),
        _settings_table(receiver, receiver.value),
        _fees_table(receiver, receiver.value),
        _transfers_table(receiver, receiver.value),
        _reporters_table(receiver, receiver.value),
        _reports_table(receiver, receiver.value) {
    _settings = _settings_table.get_or_default();
    _fees = _fees_table.get_or_default();
  }

  TABLE settings {
    name current_chain_name;
    // stores info about the token that needs to be issued
    token_info token_info;
    bool enabled;
    // whether tokens should be issued or taken from the contract balance
    bool do_issue;
    uint64_t next_transfer_id = 0;
    // duration after which transfers and reports expire can be evicted from RAM
    eosio::microseconds expire_after = days(7);
    // how many reporters need to report a transfer for it to be confirmed
    uint8_t threshold;
  };

  TABLE fees {
    asset total;
    asset reserve;
    time_point_sec last_distribution;
    double fees_percentage = 0.002;
  };

  struct [[eosio::table("transfer")]] transfer_s {
    uint64_t id; // settings.next_transfer_id
    checksum256 transaction_id;
    name from_blockchain;
    name to_blockchain;
    name from_account;
    name to_account;
    asset quantity;
    time_point_sec transaction_time;
    time_point_sec expires_at; // secondary index
    bool is_refund = false; // refunds are implemented as separate transfers

    uint64_t primary_key() const { return id; }
    uint64_t by_expiry() const { return _by_expiry(*this); }
    static uint64_t _by_expiry(const transfer_s &t) {
      return t.expires_at.sec_since_epoch();
    }

    bool operator==(const transfer_s &b) const {
      auto a = *this;
      return a.id == b.id && a.transaction_id == b.transaction_id &&
             a.from_blockchain == b.from_blockchain &&
             a.to_blockchain == b.to_blockchain &&
             a.from_account == b.from_account && a.to_account == b.to_account &&
             a.quantity == b.quantity &&
             a.transaction_time == b.transaction_time &&
             a.expires_at == b.expires_at && a.is_refund == b.is_refund;
    }
  };

  TABLE [[eosio::table("report")]] report_s {
    uint64_t id;
    transfer_s transfer;
    bool confirmed = false;
    std::vector<name> confirmed_by;
    bool executed = false;
    bool failed = false;
    std::vector<name> failed_by;

    uint64_t primary_key() const { return id; }
    uint128_t by_transfer_id() const { return _by_transfer_id(transfer); }
    static uint128_t _by_transfer_id(const transfer_s &t) {
      return static_cast<uint128_t>(t.from_blockchain.value) << 64 | t.id;
    }
    uint64_t by_expiry() const {
      return transfer_s::_by_expiry(transfer);
    }
  };

  TABLE reporter_info {
    name account;
    uint64_t points = 0;

    uint64_t primary_key() const { return account.value; }
    // need to serialize public_key
    EOSLIB_SERIALIZE(reporter_info, (account)(points))
  };

  ACTION init(name current_chain_name, token_info token_info,
              uint32_t expire_after_seconds, bool do_issue, uint8_t threshold, double fees_percentage);
  ACTION update(uint64_t threshold, double fees_percentage, uint32_t expire_after_seconds);
  ACTION enable(bool enable);
  ACTION addreporter(name reporter);
  ACTION rmreporter(name reporter);
  ACTION clear(uint64_t count);
  ACTION issuefees();
  ACTION report(name reporter, const transfer_s &transfer);
  ACTION exec(name reporter, uint64_t report_id);
  ACTION execfailed(name reporter, uint64_t report_id);

  [[eosio::on_notify("*::transfer")]] void on_transfer(
      name from, name to, asset quantity, string memo);

 private:
  using transfer_action =
      action_wrapper<name("transfer"), &reporteribc::on_transfer>;

  typedef eosio::singleton<"settings"_n, settings> settings_t;
  typedef eosio::multi_index<"settings"_n, settings>
      settings_dummy_for_abi;  // hack until abi generator generates correct name
  typedef eosio::singleton<"fees"_n, fees> fees_t;
  typedef eosio::multi_index<"fees"_n, fees>
      fees_dummy_for_abi;  // hack until abi generator generates correct name
  typedef eosio::multi_index<"transfers"_n, transfer_s,
    indexed_by<"byexpiry"_n,
                  const_mem_fun<transfer_s, uint64_t, &transfer_s::by_expiry>>
    > transfers_t;
  typedef eosio::multi_index<"reporters"_n, reporter_info> reporters_t;
  typedef eosio::multi_index<
      "reports"_n, report_s,
      indexed_by<"bytransferid"_n,
                 const_mem_fun<report_s, uint128_t, &report_s::by_transfer_id>>,
      indexed_by<"byexpiry"_n,
                 const_mem_fun<report_s, uint64_t, &report_s::by_expiry>>
      >
      reports_t;
  // keeps track of unprocessed reports that expired for manual review
  typedef eosio::multi_index<"reports.expr"_n, report_s> expired_reports_t;

  void register_transfer(const name &to_blockchain, const name &from,
                         const name &to_account, const asset &quantity,
                         bool is_refund);
  void reporter_worked(const name &reporter);
  void free_ram();

  settings _settings;
  fees _fees;
  settings_t _settings_table;
  fees_t _fees_table;
  transfers_t _transfers_table;
  reporters_t _reporters_table;
  reports_t _reports_table;


  checksum256 get_trx_id() {
    size_t size = transaction_size();
    char buf[size];
    size_t read = read_transaction(buf, size);
    check(size == read, "read_transaction failed");
    return sha256(buf, read);
  }

  struct memo_x_transfer {
    string version;
    string to_blockchain;
    string to_account;
  };

  memo_x_transfer parse_memo(string memo) {
    auto res = memo_x_transfer();
    auto parts = split(memo, ",");
    res.version = "1.0";
    res.to_blockchain = parts[0];
    res.to_account = parts[1];
    return res;
  }

  void check_reporter(name reporter) {
    auto existing = _reporters_table.find(reporter.value);

    check(existing != _reporters_table.end(),
          "the signer is not a known reporter");
  }

  name get_ibc_contract_for_chain(name chain_name) {
    switch (chain_name.value) {
      case name("eos").value: {
        return name("eosibc");
      }
      case name("wax").value: {
        return name("waxibc");
      }
      default:
        check(false, "no ibc contract for chain registered");
    }

    // make compiler happy
    return name("");
  }
};
