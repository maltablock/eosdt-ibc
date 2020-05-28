const { loadConfig, Blockchain } = require("@klevoya/hydra");

const config = loadConfig("hydra.yml");

const reporters = [`reporter1`, `reporter2`, `reporter3`];

describe("reporteribc", () => {
  let blockchain = new Blockchain(config);
  let eosIbc = blockchain.createAccount(`eosibc`);
  let waxIbc = blockchain.createAccount(`waxibc`);
  let user1 = blockchain.createAccount(`user1`);
  let user1Wax = blockchain.createAccount(`user1onwax`);
  let token = blockchain.createAccount(`eosdt`);
  let wtoken = blockchain.createAccount(`weosdt`);
  reporters.forEach((r) => blockchain.createAccount(r));

  beforeAll(async () => {
    [eosIbc, waxIbc].forEach((acc) => {
      acc.setContract(blockchain.contractTemplates[`reporteribc`]);
      acc.updateAuth(`active`, `owner`, {
        accounts: [
          {
            permission: {
              actor: acc.accountName,
              permission: `eosio.code`,
            },
            weight: 1,
          },
        ],
      });
    });
    // waxIbc.setContract(blockchain.contractTemplates[`reporteribc`]);
    // waxIbc.updateAuth(`active`, `owner`, {
    //   accounts: [
    //     {
    //       permission: {
    //         actor: waxIbc.accountName,
    //         permission: `eosio.code`,
    //       },
    //       weight: 1,
    //     },
    //   ],
    // });

    token.setContract(blockchain.contractTemplates[`eosio.token`]);
    wtoken.setContract(blockchain.contractTemplates[`eosio.token`]);
    await token.loadFixtures();
    await wtoken.loadFixtures();
  });

  it("can set everything up", async () => {
    expect.assertions(3);

    await eosIbc.contract.init({
      current_chain_name: `eos`,
      token_info: {
        symbol: `9,EOSDT`,
        contract: token.accountName,
      },
      expire_after_seconds: 86400,
      do_issue: false,
      threshold: 2,
      fees_percentage: 0.1,
      min_quantity: `1.133700000 EOSDT`,
    });
    await waxIbc.contract.init({
      current_chain_name: `wax`,
      token_info: {
        symbol: `9,WEOSDT`,
        contract: wtoken.accountName,
      },
      expire_after_seconds: 86400,
      do_issue: true,
      threshold: 2,
      fees_percentage: 0.1,
      min_quantity: `1.133700000 WEOSDT`,
    });
    for (const reporter of reporters) {
      await eosIbc.contract.addreporter({
        reporter,
      });
      await waxIbc.contract.addreporter({
        reporter,
      });
    }
    await eosIbc.contract.enable({
      enable: true,
    });
    await waxIbc.contract.enable({
      enable: true,
    });

    expect(eosIbc.getTableRowsScoped(`settings`)[eosIbc.accountName]).toEqual([
      {
        current_chain_name: "eos",
        do_issue: false,
        enabled: true,
        expire_after: {
          _count: "86400000000",
        },
        next_transfer_id: "0",
        threshold: 2,
        token_info: {
          contract: "eosdt",
          symbol: "9,EOSDT",
        },
        min_quantity: `1.133700000 EOSDT`
      },
    ]);
    expect(eosIbc.getTableRowsScoped(`fees`)[eosIbc.accountName]).toEqual([
      {
        fees_percentage: 0.1,
        last_distribution: "2000-01-01T00:00:00.000",
        reserve: "0.000000000 EOSDT",
        total: "0.000000000 EOSDT",
      },
    ]);
    expect(eosIbc.getTableRowsScoped(`reporters`)[eosIbc.accountName]).toEqual([
      {
        account: "reporter1",
        points: "0",
      },
      {
        account: "reporter2",
        points: "0",
      },
      {
        account: "reporter3",
        points: "0",
      },
    ]);
  });

  it("can do a transfer, report", async () => {
    expect.assertions(4);

    await token.contract.transfer(
      {
        from: user1.accountName,
        to: eosIbc.accountName,
        quantity: `10.000000000 EOSDT`,
        memo: `wax,user1onwax`,
      },
      [{ actor: user1.accountName, permission: `active` }]
    );

    const transferData = eosIbc.getTableRowsScoped(`transfers`)[
      eosIbc.accountName
    ][0];
    expect(transferData).toEqual({
      expires_at: "2000-01-02T00:00:00.000",
      from_account: "user1",
      from_blockchain: "eos",
      id: "0",
      quantity: "9.000000000 EOSDT",
      is_refund: false,
      to_account: "user1onwax",
      to_blockchain: "wax",
      transaction_id:
        "266B60B2C3E186B5F1B3AB6C111D79741F3D5B5E374921027E995AA1137AAE8D",
      transaction_time: "2000-01-01T00:00:00.000",
    });

    await waxIbc.contract.report(
      {
        reporter: reporters[0],
        transfer: {
          ...transferData,
          to_account: `eosdt`, // evilaccount
        },
      },
      [{ actor: reporters[0], permission: `active` }]
    );
    await waxIbc.contract.report(
      {
        reporter: reporters[1],
        transfer: transferData,
      },
      [{ actor: reporters[1], permission: `active` }]
    );
    // reporting different data leads to different reports
    expect(
      waxIbc.getTableRowsScoped(`reports`)[waxIbc.accountName].length
    ).toEqual(2);

    let tx = await waxIbc.contract.report(
      {
        reporter: reporters[2],
        transfer: transferData,
      },
      [{ actor: reporters[2], permission: `active` }]
    );

    // reported same transaction, should not have created another report entry
    expect(
      waxIbc.getTableRowsScoped(`reports`)[waxIbc.accountName].length
    ).toEqual(2);
    expect(waxIbc.getTableRowsScoped(`reports`)[waxIbc.accountName]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "1",
          confirmed: true,
          confirmed_by: ["reporter2", "reporter3"],
          transfer: transferData,
        }),
      ])
    );
  });

  it("can do an execute", async () => {
    expect.assertions(4);

    let reports = waxIbc.getTableRowsScoped(`reports`)[waxIbc.accountName];
    await waxIbc.contract.exec(
      {
        reporter: reporters[0],
        report_id: reports[1].id,
      },
      [{ actor: reporters[0], permission: `active` }]
    );

    reports = waxIbc.getTableRowsScoped(`reports`)[waxIbc.accountName];

    expect(reports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "1",
          executed: true,
        }),
      ])
    );
    expect(
      wtoken.getTableRowsScoped(`accounts`)[user1Wax.accountName]
    ).toContainEqual({
      balance: `9.000000000 WEOSDT`,
    });

    await expect(
      waxIbc.contract.exec(
        {
          reporter: reporters[0],
          report_id: reports[1].id,
        },
        [{ actor: reporters[0], permission: `active` }]
      )
    ).rejects.toHaveProperty(
      "message",
      expect.stringMatching(/already executed/gi)
    );
    await expect(
      waxIbc.contract.execfailed(
        {
          reporter: reporters[0],
          report_id: reports[1].id,
        },
        [{ actor: reporters[0], permission: `active` }]
      )
    ).rejects.toHaveProperty(
      "message",
      expect.stringMatching(/already executed/gi)
    );
  });

  it("can do a refund", async () => {
    expect.assertions(2);

    await token.contract.transfer(
      {
        from: user1.accountName,
        to: eosIbc.accountName,
        quantity: `2.987654321 EOSDT`,
        memo: `wax,user1onwax`,
      },
      [{ actor: user1.accountName, permission: `active` }]
    );

    const origTransferData = eosIbc
      .getTableRowsScoped(`transfers`)
      [eosIbc.accountName].reverse()[0];

    for (const reporter of reporters) {
      await waxIbc.contract.report(
        {
          reporter,
          transfer: origTransferData,
        },
        [{ actor: reporter, permission: `active` }]
      );
    }

    let report = waxIbc
      .getTableRowsScoped(`reports`)
      [waxIbc.accountName].reverse()[0];
    for (const reporter of reporters.slice(0, 2)) {
      await waxIbc.contract.execfailed(
        {
          reporter,
          report_id: report.id,
        },
        [{ actor: reporter, permission: `active` }]
      );
    }

    report = waxIbc
      .getTableRowsScoped(`reports`)
      [waxIbc.accountName].reverse()[0];
    // console.log(`Report after reporting failures`, report);

    expect(report).toMatchObject({
      id: "2",
      executed: false,
      failed: true,
      failed_by: reporters.slice(0, 2),
    });

    const refundTransferData = waxIbc
      .getTableRowsScoped(`transfers`)
      [waxIbc.accountName].reverse()[0];

    expect(refundTransferData).toEqual({
      ...origTransferData,
      id: `0`,
      transaction_id: `B4D8617B13BC8FB2BF51324AB93E4684020C52C4BFEC0D6909B08B0F550486FD`,
      from_account: waxIbc.accountName,
      from_blockchain: origTransferData.to_blockchain,
      to_account: origTransferData.from_account,
      to_blockchain: origTransferData.from_blockchain,
      quantity: origTransferData.quantity.split(` `)[0] + ` WEOSDT`,
      is_refund: true,
    });
  });
});
