module.exports = {
  apps : [{
    name: 'reporter',
    script: 'npm',
    // Options reference: https://pm2.io/doc/en/runtime/reference/ecosystem-file/
    args: 'start',

    instances: 1,
    autorestart: true,
  }],
};
