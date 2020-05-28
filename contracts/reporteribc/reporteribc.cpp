#include "reporteribc.hpp"
#include "../eosio.contracts/eosio.token/eosio.token.hpp"

ACTION reporteribc::init(name current_chain_name, token_info token_info,
                         uint32_t expire_after_seconds, bool do_issue,
                         uint8_t threshold, double fees_percentage, const asset& min_quantity) {
  require_auth(get_self());

  bool settings_exists = _settings_table.exists();

  check(!settings_exists, "settings already defined");
  check(threshold > 0, "threshold must be positive");
  check(min_quantity.amount >= 0, "min_quantity must be >= 0");
  check(token_info.symbol == min_quantity.symbol, "token info symbol does not match min_quantity symbol");

  _settings_table.set(
      settings{
          .current_chain_name = current_chain_name,
          .token_info = token_info,
          .enabled = false,
          .do_issue = do_issue,
          .expire_after = seconds(expire_after_seconds),
          .threshold = threshold,
          .min_quantity = min_quantity,
      },
      get_self());
  _fees_table.set(
      fees{
          .total = asset(0, token_info.symbol),
          .reserve = asset(0, token_info.symbol),
          .last_distribution = current_time_point(),
          .fees_percentage = fees_percentage,
      },
      get_self());
}

ACTION reporteribc::update(uint64_t threshold, double fees_percentage, uint32_t expire_after_seconds, const asset& min_quantity) {
  require_auth(get_self());

  check(threshold > 0, "minimum reporters must be positive");
  check(min_quantity.amount >= 0, "min_quantity must be >= 0");
  check(_settings.token_info.symbol == min_quantity.symbol, "token info symbol does not match min_quantity symbol");

  _settings.threshold = threshold;
  _settings.expire_after = seconds(expire_after_seconds);
  _settings.min_quantity = min_quantity;
  _settings_table.set(_settings, get_self());

  _fees.fees_percentage = fees_percentage;
  _fees_table.set(_fees, get_self());

  // need to update all unconfirmed reports and check if they are now confirmed
  for (auto report = _reports_table.begin(); report != _reports_table.end();
       report++) {
    if (!report->confirmed && report->confirmed_by.size() >= threshold) {
      _reports_table.modify(report, eosio::same_payer,
                            [&](auto &s) { s.confirmed = true; });
    }
  }
}

ACTION reporteribc::enable(bool enable) {
  require_auth(get_self());

  _settings.enabled = enable;
  _settings_table.set(_settings, get_self());
}

ACTION reporteribc::addreporter(name reporter) {
  require_auth(get_self());
  check(is_account(reporter), "reporter account does not exist");
  auto it = _reporters_table.find(reporter.value);

  check(it == _reporters_table.end(), "reporter already defined");

  _reporters_table.emplace(get_self(), [&](auto &s) {
    s.account = reporter;
    s.points = 0;
  });
}

ACTION reporteribc::rmreporter(name reporter) {
  require_auth(get_self());
  auto it = _reporters_table.find(reporter.value);

  check(it != _reporters_table.end(), "reporter does not exist");

  _reporters_table.erase(it);
}

ACTION reporteribc::clear(uint64_t count) {
  require_auth(get_self());

  auto current_count = 0;
  expired_reports_t expired_reports_table(get_self(), get_self().value);
  for (auto it = expired_reports_table.begin();
       it != expired_reports_table.end() && current_count < count; current_count++, it++) {
    expired_reports_table.erase(it);
  }
}

ACTION reporteribc::issuefees() {
  // can be called by anyone

  uint64_t total_points = 0;
  asset reserve = _fees.reserve;
  asset distributed = asset(0, reserve.symbol);

  for (auto reporter = _reporters_table.begin();
       reporter != _reporters_table.end(); reporter++) {
    total_points += reporter->points;
  }

  // wait until ~10 transfers have been processed
  // 1 transfer needs at least threshold reports + 1 execute
  check(total_points > (_settings.threshold + 1) * 10,
        "not enough transfers have been processed since last time");

  for (auto reporter = _reporters_table.begin();
       reporter != _reporters_table.end(); reporter++) {
    double share = (double)reporter->points / total_points;
    asset share_fees = asset(share * reserve.amount, reserve.symbol);

    distributed += share_fees;

    _reporters_table.modify(reporter, eosio::same_payer, [&](auto &s) {
      // reset points
      s.points = 0;
    });

    if(share_fees.amount > 0) {
      token::transfer_action transfer_act(_settings.token_info.contract,
                                          {get_self(), name("active")});
      transfer_act.send(get_self(), reporter->account, share_fees, "fees");
    }
  }

  // should be close to 0, roll over dust
  _fees.reserve -= distributed;
  check(_fees.reserve.amount > 0, "negative reserve, something went wrong");
  _fees.last_distribution = current_time_point();
  _fees_table.set(_fees, get_self());
}

ACTION reporteribc::report(name reporter, const transfer_s &transfer) {
  require_auth(reporter);
  check_reporter(reporter);
  reporter_worked(reporter);
  check(transfer.expires_at > current_time_point(), "transfer already expired");
  free_ram();

  auto _settings = _settings_table.get();

  check(_settings.enabled, "reporting is disabled");
  // we don't want report to fail, report anything at this point
  // it will fail at execute and then initiate a refund
  // check(is_account(transfer.to_account), "to account does not exist");

  uint128_t transfer_id = report_s::_by_transfer_id(transfer);
  auto reports_by_transfer = _reports_table.get_index<"bytransferid"_n>();
  auto report = reports_by_transfer.lower_bound(transfer_id);
  bool new_report = report == reports_by_transfer.upper_bound(transfer_id);
  if (!new_report) {
    new_report = true;
    // check and find report with same transfer data
    while (report != reports_by_transfer.upper_bound(transfer_id)) {
      if (report->transfer == transfer) {
        new_report = false;
        break;
      }
      report++;
    }
  }

  // first reporter
  if (new_report) {
    _reports_table.emplace(reporter, [&](auto &s) {
      s.id = _reports_table.available_primary_key();
      s.transfer = transfer;
      s.confirmed_by.push_back(reporter);
      s.confirmed = 1 >= _settings.threshold;
      s.executed = false;
    });
  } else {
    // checks that the reporter didn't already report the transfer
    check(std::find(report->confirmed_by.begin(), report->confirmed_by.end(),
                    reporter) == report->confirmed_by.end(),
          "the reporter already reported the transfer");

    reports_by_transfer.modify(report, reporter, [&](auto &s) {
      s.confirmed_by.push_back(reporter);
      s.confirmed = s.confirmed_by.size() >= _settings.threshold;
    });
  }
}

ACTION reporteribc::exec(name reporter, uint64_t report_id) {
  require_auth(reporter);
  check_reporter(reporter);
  reporter_worked(reporter);
  free_ram();

  auto report = _reports_table.find(report_id);
  check(report != _reports_table.end(), "report does not exist");
  check(report->confirmed, "not confirmed yet");
  check(!report->executed, "already executed");
  check(!report->failed, "transfer already failed");
  check(report->transfer.expires_at > current_time_point(),
        "report's transfer already expired");

  name token_contract = _settings.token_info.contract;
  // convert original symbol to symbol on this chain
  asset quantity =
      asset(report->transfer.quantity.amount, _settings.token_info.symbol);

  // if it's a refund we never issue new tokens, because they are still in the
  // contract
  if (!report->transfer.is_refund && _settings.do_issue) {
    // issue tokens first, self must be issuer of token
    token::issue_action issue_act(token_contract, {get_self(), "active"_n});
    issue_act.send(get_self(), quantity, "");
  }

  token::transfer_action transfer_act(token_contract, {get_self(), "active"_n});
  transfer_act.send(get_self(), report->transfer.to_account, quantity, "");

  _reports_table.modify(report, eosio::same_payer,
                        [&](auto &s) { s.executed = true; });
}

ACTION reporteribc::execfailed(name reporter, uint64_t report_id) {
  require_auth(reporter);
  check_reporter(reporter);
  reporter_worked(reporter);
  free_ram();

  auto report = _reports_table.find(report_id);
  check(report != _reports_table.end(), "report does not exist");
  check(report->confirmed, "not confirmed yet");
  check(!report->executed, "already executed");
  check(!report->failed, "transfer already failed");
  check(report->transfer.expires_at > current_time_point(),
        "report's transfer already expired");
  check(std::find(report->failed_by.begin(), report->failed_by.end(),
                  reporter) == report->failed_by.end(),
        "report already marked as failed by reporter");

  bool failed = false;
  // push_back increases RAM, use reporter as RAM payer
  _reports_table.modify(report, reporter, [&](auto &s) {
    s.failed_by.push_back(reporter);
    s.failed = failed = s.failed_by.size() >= _settings.threshold;
  });

  // init a cross-chain refund transfer
  if (failed) {
    // if original transfer already was a refund
    // stop refund ping pong and just record it in a table requiring manual
    // review
    if (report->transfer.is_refund) {
      // no_transfers_t failed_transfers_table(get_self(), get_self().value);
      // failed_transfers_table.emplace(get_self(),
      //                                [&](auto &x) { x = report->transfer; });
    } else {
      auto to_blockchain = report->transfer.from_blockchain;
      auto from = get_ibc_contract_for_chain(report->transfer.to_blockchain);
      auto to = report->transfer.from_account;
      auto quantity =
          asset(report->transfer.quantity.amount, _settings.token_info.symbol);
      register_transfer(to_blockchain, from, to, quantity, true);
    }
  }
}

void reporteribc::on_transfer(name from, name to, asset quantity, string memo) {
  if (from == get_self() || from == "eosio.ram"_n || from == "eosio.stake"_n ||
      from == "eosio.rex"_n)
    return;

  if (get_first_receiver() != _settings.token_info.contract) return;

  check(to == get_self(), "contract not involved in transfer");
  check(quantity.symbol == _settings.token_info.symbol,
        "correct token contract, but wrong symbol");
  check(quantity >= _settings.min_quantity,
        "sent quantity is less than required min quantity");

  const memo_x_transfer &memo_object = parse_memo(memo);

  std::string to_blockchain(memo_object.to_blockchain);
  std::transform(to_blockchain.begin(), to_blockchain.end(),
                 to_blockchain.begin(),
                 [](unsigned char c) { return std::tolower(c); });

  name to_blockchain_name = name(to_blockchain);

  check(
      to_blockchain_name == name("eos") || to_blockchain_name == name("wax"),
      "invalid memo: target blockchain \"" + to_blockchain + "\" is not valid");
  check(_settings.current_chain_name != to_blockchain_name,
        "cannot send to the same chain");
  check(memo_object.to_account.size() > 0 && memo_object.to_account.size() < 13,
        "invalid memo: target name \"" + memo_object.to_account +
            "\" is not valid");

  register_transfer(to_blockchain_name, from, name(memo_object.to_account),
                    quantity, false);
}

void reporteribc::register_transfer(const name &to_blockchain, const name &from,
                                    const name &to_account,
                                    const asset &quantity,
                                    bool is_refund = false) {
  check(_settings.enabled, "ibc transfers are disabled");
  const auto transfer_id = _settings.next_transfer_id;
  _settings.next_transfer_id += 1;

  auto fees = asset(is_refund ? 0 : _fees.fees_percentage * quantity.amount,
                    quantity.symbol);
  auto quantity_after_fees = quantity - fees;
  _fees.reserve += fees;
  _fees.total += fees;

  // record this transfer in case we need to refund it
  _transfers_table.emplace(get_self(), [&](auto &x) {
    x.id = transfer_id;
    x.transaction_id = get_trx_id();
    x.from_blockchain = _settings.current_chain_name;
    x.to_blockchain = to_blockchain;
    x.from_account = from;
    x.to_account = to_account;
    x.quantity = quantity_after_fees;
    x.transaction_time = current_time_point();
    x.expires_at = current_time_point() + _settings.expire_after;
    x.is_refund = is_refund;
  });

  _fees_table.set(_fees, get_self());
  _settings_table.set(_settings, get_self());
}

void reporteribc::reporter_worked(const name &reporter) {
  auto it = _reporters_table.find(reporter.value);
  check(it != _reporters_table.end(), "reporter does not exist while PoW");

  _reporters_table.modify(it, eosio::same_payer, [&](auto &s) { s.points++; });
}

void reporteribc::free_ram() {
  // delete 2 expired transfers and 2 expired reports
  uint64_t now = current_time_point().sec_since_epoch();
  auto count = 0;
  auto transfers_by_expiry = _transfers_table.get_index<name("byexpiry")>();
  for (auto it = transfers_by_expiry.lower_bound(0);
       it != transfers_by_expiry.upper_bound(now) && count < 2; count++, it = transfers_by_expiry.lower_bound(0)) {
    transfers_by_expiry.erase(it);
  }

  auto reports_by_expiry = _reports_table.get_index<name("byexpiry")>();
  count = 0;
  for (auto it = reports_by_expiry.lower_bound(0);
       it != reports_by_expiry.upper_bound(now) && count < 2; count++, it = reports_by_expiry.lower_bound(0)) {
    // track reports that were not executed and where no refund was initiated
    if (!it->executed && !it->failed) {
      expired_reports_t expired_reports_table(get_self(), get_self().value);
      expired_reports_table.emplace(get_self(), [&](auto &x) { x = *it; });
    }
    reports_by_expiry.erase(it);
  }
}