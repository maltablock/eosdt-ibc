import { NetworkName } from "../types"

export const latestHealth: {[key: string]: {block: number, time: string}} = {}

export const pulse = (network: NetworkName, headBlock:number, headTime: string) => {
  latestHealth[network] = { block: headBlock, time: `${headTime}Z` }
}