const initEnvironment = require(`eosiac`);
const { getAccountNames } = require(`./_helpers`);

const envName = process.env.EOSIAC_ENV || `dev`;

const { api, sendTransaction, env } = initEnvironment(envName, { verbose: true });

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

    let { USER_1: X_CHAIN_USER } = getAccountNames(envName === `kylin` ? `waxtest` : `kylin`)
    // X_CHAIN_USER = `me.no.exists`

    const data = {
      from: USER_1,
      to: IBC_CONTRACT,
      quantity: `1.000000000 ${SYMBOL_CODE}`,
      memo: `${otherChain},${X_CHAIN_USER}`,
    }
    console.log(data)

    await sendTransaction([
      {
        account: TOKEN_CONTRACT,
        name: `transfer`,
        authorization: [
          {
            actor: USER_1,
            permission: `active`,
          },
        ],
        data,
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
