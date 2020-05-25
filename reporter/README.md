# IBC Reporter

Nodejs app running on a server that scans all blockchans for events and handles IBC.

## Deplyoment

The reporter requires environment variables to be set:

```bash
# account name on EOS; permission used for reporting; private key for permission
EOS_IBC=maltareports;active;5JzSdC...
# ⚠️ Use your own endpoint here
EOS_ENDPOINT=https://api.eossweden.org:443
# same for WAX
WAX_ENDPOINT=https://chain.wax.io:443
WAX_IBC=maltareports;active;5JzSdC...
```


It can be deployed on servers like any other NodeJS app.
It's stateless and does not require any database.

```bash
npm install
npm run build
npm start
```

See the Docker image for a dockerized deployment.

#### Different CPU payer

One can specify a different CPU payer for the actions run by the reporters.

```bash
# append cpu-account;cpu-key to the existing reporter;permission;key
EOS_IBC=maltareports;active;5JzSdC...;cpupayer;5k...
```

## Monitoring

There are some optional endpoints that can be used to check the health of the reporter, or a list of logs and performed transfer events.

A simple health check reporting the last checked block number on the chains can be seen on [/health](http://localhost:8080/health).

Logs can be seen on [/logs](http://localhost:8080/logs).
