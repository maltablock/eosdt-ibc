const initEnvironment = require(`eosiac`);
const { getAccountNames } = require(`./_helpers`);

const envName = process.env.EOSIAC_ENV || `dev`;

const { api, sendTransaction, env } = initEnvironment(envName, {
  verbose: true,
});

const { IBC_CONTRACT } = getAccountNames();

const EOS_REPORTERS = [`maltablock.2`];
const WAX_REPORTERS = [`maltablockbp`, `eosphereiobp`, `alohaeosprod`];

async function action() {
  const thisChain = envName.includes(`wax`) ? `wax` : `eos`;
  // const thisReporters =
  //   thisChain === `wax` ? WAXTEST_REPORTERS : KYLIN_REPORTERS;
  const thisReporters = thisChain === `wax` ? WAX_REPORTERS : EOS_REPORTERS;

  try {
    const tx = await sendTransaction([
      ...thisReporters.map(reporter => ({
        account: IBC_CONTRACT,
        name: `rmreporter`,
        authorization: [
          {
            actor: IBC_CONTRACT,
            permission: `active`,
          },
        ],
        data: {
          reporter: reporter,
        },
      }))
    ]);

    console.log(tx);

    process.exit(0);
  } catch (error) {
    console.error(error.message);
  }
  // ignore
  process.exit(1);
}

action();
