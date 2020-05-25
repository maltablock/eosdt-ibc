import { NetworkName } from "../types";
import { Api } from "eosjs";
import { JsSignatureProvider } from "eosjs/dist/eosjs-jssig";
import { TextDecoder, TextEncoder } from "util";
import { getRpc } from "./networks";
import { logger } from "../logger";
import { getEnvConfig } from "../dotenv";
import { isProduction, unmapNetworkName } from "../utils";

export const getApi: (networkName: string) => Api = (() => {
  const apis = {};

  return (networkName: string) => {
    let _networkName = unmapNetworkName(networkName as NetworkName);

    if (!apis[_networkName]) {
      const envConfig = getEnvConfig();
      if (!envConfig[_networkName])
        throw new Error(`Environment variables not loaded for: ${_networkName}`);

      const signatureProvider = new JsSignatureProvider([
        envConfig[_networkName].reporterKey,
        envConfig[_networkName].cpuKey,
      ].filter(Boolean));
      apis[_networkName] = new Api({
        rpc: getRpc(networkName),
        signatureProvider,
        textDecoder: new TextDecoder(),
        textEncoder: new TextEncoder() as any,
      });
    }

    return apis[_networkName];
  };
})();
