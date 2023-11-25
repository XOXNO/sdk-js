import {
  API_URL,
  DR_SC,
  FM_SC,
  KG_SC,
  Manager_SC,
  Manager_SC_DEV,
  P2P_SC,
  P2P_SC_DEV,
  Staking_SC,
  Staking_SC_DEV,
  XOXNO_SC,
  XOXNO_SC_DEV,
} from './const';
import { IChainID } from '@multiversx/sdk-core/out/interface';
export enum Chain {
  MAINNET = '1',
  DEVNET = 'D',
}
export default class XOXNOClient {
  private static instance: XOXNOClient;
  public apiUrl: string;
  private apiKey: string;
  public chain: IChainID;
  public config: {
    XO_SC: string;
    FM_SC: string;
    DR_SC: string;
    KG_SC: string;
    Staking_SC: string;
    Manager_SC: string;
    P2P_SC: string;
  };

  private constructor(
    apiUrl: string = API_URL,
    apiKey = '',
    chain: Chain = Chain.MAINNET
  ) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    this.chain = chain;
    this.config =
      chain === Chain.MAINNET
        ? {
            XO_SC: XOXNO_SC,
            FM_SC: FM_SC,
            DR_SC,
            KG_SC,
            Staking_SC,
            Manager_SC,
            P2P_SC,
          }
        : {
            XO_SC: XOXNO_SC_DEV,
            FM_SC,
            DR_SC,
            KG_SC,
            Staking_SC: Staking_SC_DEV,
            Manager_SC: Manager_SC_DEV,
            P2P_SC: P2P_SC_DEV,
          };
  }

  public static init(
    apiUrl: string = API_URL,
    apiKey = '',
    chain: Chain = Chain.MAINNET
  ): XOXNOClient {
    if (!XOXNOClient.instance) {
      XOXNOClient.instance = new XOXNOClient(apiUrl, apiKey, chain);
    }
    return XOXNOClient.instance;
  }

  public fetchWithTimeout = async <T>(
    path: string,
    options: Record<string, unknown> = {},
    timeout = 40000
  ): Promise<T> => {
    const headers = {
      'Accept-Encoding': 'gzip,deflate,br',
      Referer: 'https://xoxno.sdk',
      'User-Agent': 'XOXNO/1.0/SDK',
      ...(options.method === 'POST'
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...((options.headers as object) ?? {}),
    };
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), timeout);
      const res = await fetch(
        `${this.apiUrl}${path}${
          options.params
            ? '?' +
              Object.keys(options.params as any)
                .map((key) => {
                  return `${key}=${encodeURIComponent(
                    (options.params as any)[key]
                  )}`;
                })
                .join('&')
            : ''
        }`,
        {
          ...options,
          signal: controller.signal,
          ...(Object.keys(headers).length ? { headers } : {}),
          method: (options.method as any) ?? 'GET',
        }
      );
      if (!res.ok) throw new Error((await res.json()).message.toString());
      return res.json() as T;
    } catch (error: Error | any) {
      throw new Error(
        'Something went wrong inside fetchWithTimeout' +
          ' ' +
          path +
          ' ' +
          JSON.stringify(options) +
          ' ' +
          error?.message?.toString() ?? error.toString()
      );
    }
  };
}
