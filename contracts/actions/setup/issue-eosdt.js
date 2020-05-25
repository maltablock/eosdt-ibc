const initEnvironment = require(`eosiac`);
const { getAccountNames } = require(`../_helpers`);

const envName = process.env.EOSIAC_ENV || `dev`;

const { sendTransaction, env } = initEnvironment(envName, { verbose: true });

const { TOKEN_CONTRACT, IBC_CONTRACT, REPORTER_1, USER_1 } = getAccountNames();

async function action() {
  const SYMBOL_CODE = envName.includes(`wax`) ? `WEOSDT` : `EOSDT`;
  const RECEIVER = `alohaeostest`
  try {
    await sendTransaction([
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
          quantity: `100000.000000000 ${SYMBOL_CODE}`,
          memo: `some tokens`,
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
          to: RECEIVER,
          quantity: `100000.000000000 ${SYMBOL_CODE}`,
          memo: `some more tokens`,
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
