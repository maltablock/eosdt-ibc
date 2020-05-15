export interface IEOSNetwork {
  chainId: string;
  nodeEndpoint: string;
  protocol: string;
  host: string;
  port: number;
}


type TActionTrace = {
  console: string;
  inline_traces: TActionTrace[]
}

export type TTransactionResult = {
  transaction_id: string;
  processed: {
    action_traces: TActionTrace[];
  };
};
