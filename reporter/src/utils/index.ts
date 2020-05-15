import { NetworkName } from "../types";
import { RpcError } from "eosjs";

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const isProduction = () => process.env.NODE_ENV === `production`;

export const formatBloksTransaction = (network: NetworkName, txId: string) => {
  const _network = unmapNetworkName(network)
  let bloksNetworkName = _network as string;
  if(_network === `eos`) bloksNetworkName = ``
  else if(_network === `waxtest`) bloksNetworkName = `wax-test`

  const prefix = bloksNetworkName ? `${bloksNetworkName}.` : ``;
  return `https://${prefix}bloks.io/transaction/${txId}`;
};

// export const mapNetworkName = (network: NetworkName): NetworkName => {
//   if (isProduction()) {
//     return network;
//   }

//   switch (network) {
//     case `kylin`:
//       return `eos`;
//     case `waxtest`:
//       return `wax`;
//   }
// };

export const unmapNetworkName = (network: NetworkName): NetworkName => {
  if (isProduction()) {
    return network;
  }

  switch (network) {
    case `eos`:
      return `kylin`;
    case `wax`:
      return `waxtest`;
  }
};

export const pickRandom = <T>(array: T[]):T => {
  if (!Array.isArray(array) || array.length === 0) return null;

  return array[Math.floor(Math.random() * array.length)];
};

export const extractRpcError = (err: Error|RpcError|any) => {
  let message = err.message
  if(err instanceof RpcError) {
    try {
      message = JSON.parse(err.message).error.details.map(detail => {
        return detail.message
      }).join(`\n`)
    } catch {}
  } else if (err.json) {
    // might only be LiquidAPps client lib
    if(err.json.error) return err.json.error;
  }
  return message
}

// on dev config from real eos is mapped to kylin, wax to waxtest
export const ALL_NETWORKS: NetworkName[] = [`eos`, `wax`, `kylin`, `waxtest`];
export const NETWORKS_TO_WATCH: NetworkName[] = isProduction()
  ? [`eos`, `wax`]
  : [`eos`, `wax`];
