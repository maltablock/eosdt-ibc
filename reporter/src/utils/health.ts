import { NetworkName } from "../types"

export const latestHealth: {[key: string]: {block?: number, time?: Date, lastError?: { message: string, date: Date }}} = {}

export const pulse = (network: NetworkName, headBlock:number, headTime: string) => {
  latestHealth[network] = { ...latestHealth[network], block: headBlock, time: new Date(`${headTime}Z`) }
}
export const pulseError = (network: NetworkName, errorMessage: string) => {
  latestHealth[network] = { ...latestHealth[network], lastError: { message: errorMessage, date: new Date()} }
}