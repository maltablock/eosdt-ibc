import * as dotenv from "dotenv";
import { ALL_NETWORKS } from "./utils";
import { NetworkName } from "./types";

dotenv.config();

export const getEnvConfig = () => {
  const parse = (networkName: NetworkName) => {
    const VAR_NAME = `${networkName.toUpperCase()}_IBC`;
    const val = process.env[VAR_NAME];
    if (!val)
      throw new Error(
        `Missing environment variable '${VAR_NAME}' for chain ${networkName}`
      );

    const [acc, permission, key] = val.split(`;`).map((x) => x.trim());
    return {
      reporterAccount: acc,
      reporterPermission: permission,
      reporterKey: key,
    };
  };

  return ALL_NETWORKS.reduce(
    (acc, network) => ({
      ...acc,
      [network]: parse(network),
    }),
    {}
  ) as {
    [key: string]: {
      reporterAccount: string;
      reporterPermission: string;
      reporterKey: string;
    };
  };
};
