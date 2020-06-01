const initEnvironment = require(`eosiac`);
const { getAccountNames } = require(`../_helpers`);

const envName = process.env.EOSIAC_ENV || `dev`;

const { sendTransaction, env } = initEnvironment(envName, { verbose: true });

const {
  TOKEN_CONTRACT,
  IBC_CONTRACT,
  REPORTER_1,
  REPORTER_2,
  USER_1,
} = getAccountNames();

async function action() {
  try {
    const thisChain = envName.includes(`wax`) ? `wax` : `eos`;
    const otherChain = thisChain === `eos` ? `wax` : `eos`;
    const SYMBOL_CODE = thisChain === `wax` ? `WEOSDT` : `EOSDT`;

    await sendTransaction([
      {
        account: IBC_CONTRACT,
        name: `init`,
        authorization: [
          {
            actor: IBC_CONTRACT,
            permission: `active`,
          },
        ],
        data: {
          current_chain_name: thisChain,
          token_info: {
            symbol: `9,${SYMBOL_CODE}`,
            contract: TOKEN_CONTRACT,
          },
          expire_after_seconds: 600, // 86400,
          do_issue: thisChain === `wax`,
          threshold: 1,
          fees_percentage: 0.1,
          min_quantity: `1.000000000 ${SYMBOL_CODE}`,
        },
      },
      {
        account: IBC_CONTRACT,
        name: `enable`,
        authorization: [
          {
            actor: IBC_CONTRACT,
            permission: `active`,
          },
        ],
        data: {
          enable: true,
        },
      },
    ]);

    for (const reporter of [REPORTER_1, REPORTER_2]) {
      await sendTransaction({
        account: IBC_CONTRACT,
        name: `addreporter`,
        authorization: [
          {
            actor: IBC_CONTRACT,
            permission: `active`,
          },
        ],
        data: {
          reporter: reporter,
        },
      });
    }

    process.exit(0);
  } catch (error) {
    console.error(error.message);
    // ignore
    process.exit(1);
  }
}

action();
