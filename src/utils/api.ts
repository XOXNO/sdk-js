import axios from 'axios';
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
export enum Chain {
  MAINNET = '1',
  DEVNET = 'D',
}
export class XOXNOClient {
  private static instance: XOXNOClient;
  public apiUrl: string;
  private apiKey: string;
  public chain: Chain;
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

  public static getClient(): XOXNOClient {
    if (!XOXNOClient.instance) {
      this.init();
    }
    return XOXNOClient.instance;
  }

  public fetchWithTimeout = async <T>(
    path: string,
    options: Record<string, unknown> = {},
    timeout = 40000
  ): Promise<T> => {
    const timestamp = Math.round(new Date().getTime() / 1000);

    const headers = {
      'Accept-Encoding': 'gzip,deflate,br',
      'xo-time': `Sent-At:${timestamp}`,
      Referer: 'https://xoxno.sdk',
      'User-Agent': 'XOXNO/1.0/SDK',
      ...(options.method === 'POST'
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...((options.headers as object) ?? {}),
    };
    try {
      const { data } = await axios(
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
          timeout,
          ...options,
          ...(Object.keys(headers).length ? { headers } : {}),
          method: (options.method as any) ?? 'GET',
        }
      );

      const result = data;

      return result as T;
    } catch (error) {
      throw new Error(
        'Something went wrong inside fetchWithTimeout' +
          ' ' +
          path +
          ' ' +
          JSON.stringify(options) +
          ' ' +
          error
      );
    }
  };
}
