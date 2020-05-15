# reporteribc

## Contract Tables:

#### Settings

The `settings` table stores general configuration data:

```cpp
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
```

It is initialized once using the `init` action.
Further updates to the `threshold` can be done using the `update` function.

#### Fees

The `fees` table stores all information related to fees:

```cpp
asset total;
asset reserve;
time_point_sec last_distribution;
double fees_percentage = 0.002;
```

The fee percentage can be updated using the `update` function.
Currently, fees can be distributed to the reporters every 30 days using a simple point system. Every report and execute of a transfer is one point - the fees for the reporters are distributed on a pro rata basis.

#### Transfers

The `transfers` table stores every transfer from users to this contract.

```cpp
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
```

Note that the `id` is not unique among all chains. A cross-chain unique id can be used by combining `from_blockchain` with `id`.

#### Reports

The `reports` table stores reported transfers **from another chain**.
The transfer data is a plain copy of the original transfer table row on the original chain.

```cpp
uint64_t id;
transfer transfer; // copy of original transfer
bool confirmed = false;
std::vector<name> confirmed_by;
bool executed = false;
bool failed = false;
std::vector<name> failed_by;
```

#### Reporters

The `reporters` table stores the active reporters:

```cpp
name account;
uint64_t points = 0;
```

Reporters can be added and removed using the `addreporter` and `rmreporter` actions.

## Overview: Successful Transfer

The contract and the reporters process cross-chain transfers the following way.
As an example, consider a transfer from EOS to WAX.

### EOS: EOSDT transfer to `eosibc` account with memo: `wax,waxaccount`

User sends a transfer to the ibc contract.
Fees are subtracted from the quantity and the contract stores the adjusted transfer in its `transfers` table with the following data:

```cpp
// transfer
id; // from settings
transaction_id; // id of this transaction
from_blockchain; // "eos"
to_blockchain; // "wax"
from_account; // "eosaccount"
to_account; // "waxaccount"
quantity; // quantity - fees
transaction_time; // current time of transaction
expires_at; // current time + settings.expire_after
is_refund = false;
```

### EOS/WAX: Reporter checks contracts and reports new transfers

The reporters can use any EOSIO node of the EOS chain to read the tables of the contract:

- Fetches head block number and last irreversible block number
- Fetches non-expired _transfers_ using secondary key on `transfers` table
- Fetches non-expired _reports_ on the supported opposing chains.
- Crosschecks transfer's target_blockchain and reports to see if transfer has already been reported by themself.
- If not, reports the transfer on the target blockchain using the `report(reporter, transfer)` action.

The contract on WAX stores the report along with the transfer data in the `reports` table:

```cpp
// reports
id;
transfer; // copy of original transfer
confirmed = false;
confirmed_by;
executed = false;
failed = false;
failed_by;
```


### WAX: `waxibc` contract receives several reports

The contract on WAX receives several reports of same transfer by different reporters until the configured threshold is reached.
The report (and the transfer) is then marked as confirmed.

```cpp
// reports
id
confirmed: true
```

### WAX: Execute transfer

- Reporter fetches the `reports` table of the `waxibc` contract and checks if any report is `confirmed` but not `executed` yet.
- Reporter tries executing the transfer using the `exec(reporter, report_id)` which sets `execute=true` and sends inline transfer action to the target_account.
- Assuming the execution succeeded, the report is marked as executed. (For the failure case, see scenario below.)

```cpp
id
executed: true
```


## Example: Failed Transfer

There are two actions by the reporter that can fail - the `report` and the `exec` action.

### WAX: Fail at report

The `report` transaction is fully under the reporter's and ibc contract's control and therefore shouldn't continously fail. It could fail because of CPU issues / blockchain issues, but it will be retried in these cases.

### WAX: Fail at execution

This is the more interesting case as it could fail because the account does not exist on-chain or the account has a contract that rejects the transfer.

- When the reporter's `exec` transaction failed, they will follow up with a `execfailed(reporter, report_id)` transaction.
- This adds the reporter to the `failed_by` field.
    ```cpp
failed_by: [reporter_name]
failed: true // gets locked if failed.executions.length >= threshold
    ```
- If the number of failed executions has reached the configured threshold, a reverse transfer is added to the `tranfers` table, essentialy requesting a cross-chain refund transfer (ignoring fees).

```cpp
// new transfer added
id: new_id
from_blockchain: old_transfer.to_blockchain
to_blockchain: old_transfer.from_blockchain
from_account: old_transfer.from_blockchain.ibcContract
to_account: old_transfer.from_account
is_refund: true // to handle logic like no fees
```

This refund transfer is treated the same as any transfer from WAX -> EOS by the reporters.

# Testnet Example

## Kylin

- [IBC Contract](https://kylin.bloks.io/account/ibc1eos1con2)
- [Token Contract](https://kylin.bloks.io/account/ibc1eos1tok2)
- [Reporter 1](https://kylin.bloks.io/account/ibc1eos1rep1)
- [Reporter 2](https://kylin.bloks.io/account/ibc1eos1rep2)

## Wax Testnet

- [IBC Contract](https://wax-test.bloks.io/account/ibc1wax1con2)
- [Token Contract](https://wax-test.bloks.io/account/ibc1wax1tok2)
- [Reporter 1](https://wax-test.bloks.io/account/ibc1wax1rep1)
- [Reporter 2](https://wax-test.bloks.io/account/ibc1wax1rep2)
