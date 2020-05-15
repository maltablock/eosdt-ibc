const initEnvironment = require(`eosiac`);
const { getAccountNames } = require(`../_helpers`);

const envName = process.env.EOSIAC_ENV || `dev`;

const { sendTransaction, env } = initEnvironment(envName, { verbose: true });

const { TOKEN_CONTRACT, IBC_CONTRACT, REPORTER_1, USER_1 } = getAccountNames();

async function action() {
  const SYMBOL_CODE = envName.includes(`wax`) ? `WEOSDT` : `EOSDT`;
  try {
    await sendTransaction([
      {
        account: TOKEN_CONTRACT,
        name: `create`,
        authorization: [
          {
            actor: TOKEN_CONTRACT,
            permission: `active`,
          },
        ],
        data: {
          issuer: IBC_CONTRACT,
          // https://bloks.io/account/eosdtsttoken?loadContract=true&tab=Tables&table=stat&account=eosdtsttoken&scope=EOSDT&limit=100
          maximum_supply: `170000000.000000000 ${SYMBOL_CODE}`,
        },
      },
      {
        account: TOKEN_CONTRACT,
        name: `issue`,
        authorization: [
          {
            actor: IBC_CONTRACT,
            permission: `active`,
          },
        ],
        data: {
          to: IBC_CONTRACT,
          quantity: `1000000.000000000 ${SYMBOL_CODE}`,
          memo: `issue some of it`,
        },
      },
      {
        account: TOKEN_CONTRACT,
        name: `transfer`,
        authorization: [
          {
            actor: IBC_CONTRACT,
            permission: `active`,
          },
        ],
        data: {
          from: IBC_CONTRACT,
          to: USER_1,
          quantity: `1000000.000000000 ${SYMBOL_CODE}`,
          memo: `transfer all of it`,
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
