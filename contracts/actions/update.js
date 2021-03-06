const initEnvironment = require(`eosiac`);
const { getAccountNames } = require(`./_helpers`);

const envName = process.env.EOSIAC_ENV || `dev`;

const { api, sendTransaction, env } = initEnvironment(envName, { verbose: true });

const {
  IBC_CONTRACT,
} = getAccountNames();


async function action() {
  const thisChain = envName.includes(`wax`) ? `wax` : `eos`;
  const SYMBOL_CODE = thisChain === `wax` ? `WEOSDT` : `EOSDT`;

  try {
    await sendTransaction([
      {
        account: IBC_CONTRACT,
        name: `update`,
        authorization: [
          {
            actor: IBC_CONTRACT,
            permission: `active`,
          },
        ],
        data: {
          threshold: 2,
          fees_percentage: 0.1,
          expire_after_seconds: 86400 * 3,
          min_quantity: `1.000000000 ${SYMBOL_CODE}`
        },
      },
    ]);

    process.exit(0);
  } catch (error) {
    console.error(error.message);
    // ignore
    process.exit(1);
  }
}

action();
