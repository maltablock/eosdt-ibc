const initEnvironment = require(`eosiac`);
const { getAccountNames } = require(`./_helpers`);

const envName = process.env.EOSIAC_ENV || `dev`;

const { api, sendTransaction, env } = initEnvironment(envName, {
  verbose: true,
});

const { IBC_CONTRACT } = getAccountNames();

const KYLIN_REPORTERS = [`alohaeostest`, `kylsphererpt`];
const WAXTEST_REPORTERS = [`alohaeosprod`, `waxsphererpt`];
async function action() {
  const thisChain = envName.includes(`wax`) ? `wax` : `eos`;
  const thisReporters =
    thisChain === `wax` ? WAXTEST_REPORTERS : KYLIN_REPORTERS;

  for (const reporter of thisReporters.slice(1)) {
    try {
      const tx = await sendTransaction([
        {
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
        },
      ]);

      console.log(tx);

      process.exit(0);
    } catch (error) {
      console.error(error.message);
    }
  }
  // ignore
  process.exit(1);
}

action();
