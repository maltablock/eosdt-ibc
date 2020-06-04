import { JsonRpc } from "eosjs";
import fetch from "node-fetch";
import { NetworkName } from "../types";
import { getEnvConfig } from "../dotenv";
import { isProduction, unmapNetworkName } from "../utils";

export const getContractsForNetwork = (
  network: NetworkName
): {
  token: string;
  ibc: string;
  cpuPayer: string;
  reporterAccount: string;
  reporterPermission: string;
} => {
  network = unmapNetworkName(network);
  const envConfig = getEnvConfig();
  switch (network) {
    case `kylin`:
      return {
        token: `ibc1eos1tok3`,
        ibc: `ibc1eos1con3`,
        cpuPayer: ``,
        ...((envConfig.kylin || {}) as any),
      };
    case `waxtest`:
      return {
        token: `ibc1wax1tok3`,
        ibc: `ibc1wax1con3`,
        cpuPayer: ``,
        ...((envConfig.waxtest || {}) as any),
      };
    case `eos`:
      return {
        token: `eosdtsttoken`,
        ibc: `eosdttowaxxx`,
        cpuPayer: ``,
        ...((envConfig.eos || {}) as any),
      };
    case `wax`:
      return {
        token: `weosdttokens`,
        ibc: `weosdttoeoss`,
        cpuPayer: ``,
        ...((envConfig.wax || {}) as any),
      };
    default:
      throw new Error(
        `No contract accounts for "${network}" network defined yet`
      );
  }
};

const createNetwork = (nodeEndpoint, chainId) => {
  const matches = /^(https?):\/\/(.+?)(:\d+){0,1}$/.exec(nodeEndpoint);
  if (!matches) {
    throw new Error(
      `Could not parse HTTP endpoint for chain ${chainId}. Needs protocol and port: "${nodeEndpoint}"`
    );
  }

  const [, httpProtocol, host, portMatch] = matches;
  const portString = portMatch
    ? portMatch.replace(/\D/gi, ``)
    : httpProtocol === `https`
    ? `443`
    : `80`;
  const port = Number.parseInt(portString, 10);

  return {
    chainId,
    protocol: httpProtocol,
    host,
    port,
    nodeEndpoint,
  };
};

const KylinNetwork = createNetwork(
  process.env.KYLIN_ENDPOINT || `https://kylin.eos.dfuse.io`,
  `5fff1dae8dc8e2fc4d5b23b2c7665c97f9e9d8edf2b6485a86ba311c25639191`
);
const WaxTestNetwork = createNetwork(
  process.env.WAXTEST_ENDPOINT || `https://waxtestnet.greymass.com`,
  `f16b1833c747c43682f4386fca9cbb327929334a762755ebec17f6f23c9b8a12`
);
const MainNetwork = createNetwork(
  process.env.EOS_ENDPOINT,
  `aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906`
);
const WaxNetwork = createNetwork(
  process.env.WAX_ENDPOINT,
  `1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4`
);

function getNetwork(networkName: string) {
  switch (networkName) {
    case `eos`:
      return MainNetwork;
    case `wax`:
      return WaxNetwork;
    case `kylin`:
      return KylinNetwork;
    case `waxtest`:
      return WaxTestNetwork;
    default:
      throw new Error(`Network "${networkName}" not supported yet.`);
  }
}

export const getRpc: (networkName: string) => JsonRpc = (() => {
  const rpcs = {};

  return (networkName: string) => {
    let _networkName = unmapNetworkName(networkName as NetworkName);
    if (!rpcs[networkName]) {
      rpcs[networkName] = new JsonRpc(getNetwork(_networkName).nodeEndpoint, {
        fetch: fetch,
      });
    }

    return rpcs[networkName];
  };
})();
