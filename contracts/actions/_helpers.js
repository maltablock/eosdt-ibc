const initEnvironment = require(`eosiac`);
const defaultEnvName = process.env.EOSIAC_ENV || `dev`;

const getAccountNames = (envName = defaultEnvName) => {
  const { env } = initEnvironment(envName, {
    verbose: false
  });

  const accounts = Object.keys(env.accounts);

  let TOKEN_CONTRACT, IBC_CONTRACT, REPORTER_1, REPORTER_2, USER_1, CPU_PAYER;

  if(envName === `wax`) {
    [
      IBC_CONTRACT,
      TOKEN_CONTRACT,
      REPORTER_1,
    ] = accounts;
  } else if(envName === `mainnet`) {
    [
      IBC_CONTRACT,
      TOKEN_CONTRACT,
      REPORTER_1,
    ] = accounts;
  } else {
    [
      CPU_PAYER,
      IBC_CONTRACT,
      TOKEN_CONTRACT,
      REPORTER_1,
      REPORTER_2,
      USER_1,
    ] = accounts;
  }

  return {
    CPU_PAYER,
    TOKEN_CONTRACT,
    IBC_CONTRACT,
    REPORTER_1,
    REPORTER_2,
    USER_1,
  };
};

console.log(getAccountNames());

module.exports = {
  getAccountNames
};
