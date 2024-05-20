import {
  API_URL,
  API_URL_DEV,
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
import type { IChainID } from '@multiversx/sdk-core/out/interface';
export enum Chain {
  MAINNET = '1',
  DEVNET = 'D',
}
export class XOXNOClient {
  private static instance: XOXNOClient;
  public apiUrl: string;
  private apiKey: string;
  public chain: IChainID;
  public config: {
    mediaUrl: string;
    XO_SC: string;
    FM_SC: string;
    DR_SC: string;
    KG_SC: string;
    Staking_SC: string;
    Manager_SC: string;
    P2P_SC: string;
  };

  private constructor(apiUrl: string = API_URL, apiKey = '', chain: Chain) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    this.chain = chain;
    this.config =
      chain == Chain.MAINNET
        ? {
            mediaUrl: 'https://media.xoxno.com',
            XO_SC: XOXNO_SC,
            FM_SC: FM_SC,
            DR_SC,
            KG_SC,
            Staking_SC,
            Manager_SC,
            P2P_SC,
          }
        : {
            mediaUrl: 'https://devnet-media.xoxno.com',
            XO_SC: XOXNO_SC_DEV,
            FM_SC,
            DR_SC,
            KG_SC,
            Staking_SC: Staking_SC_DEV,
            Manager_SC: Manager_SC_DEV,
            P2P_SC: P2P_SC_DEV,
          };
  }

  public static init({
    apiUrl = API_URL,
    apiKey = '',
    chain = Chain.MAINNET,
  }: Partial<{
    apiUrl?: string;
    apiKey?: string;
    chain?: Chain;
  }> = {}): XOXNOClient {
    if (XOXNOClient.instance == null || XOXNOClient.instance == undefined) {
      if (chain == Chain.DEVNET) {
        XOXNOClient.instance = new XOXNOClient(
          apiUrl ?? API_URL_DEV,
          apiKey,
          chain
        );
        return XOXNOClient.instance;
      }
      XOXNOClient.instance = new XOXNOClient(apiUrl, apiKey, chain);
    }
    return XOXNOClient.instance;
  }

  public static getInstance(): XOXNOClient {
    if (XOXNOClient.instance == null || XOXNOClient.instance == undefined) {
      throw new Error('XOXNOClient is not initialized');
    }
    return XOXNOClient.instance;
  }

  public fetchWithTimeout = async <T>(
    path: string,
    options: Record<string, any> = {},
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
    const shouldInsertOrigin = typeof path === 'string' && path.startsWith('/');
    const url = `${shouldInsertOrigin ? `${this.apiUrl}${path}` : path}${
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
    }`;

    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, {
      ...options,
      ...(options?.next && options.next.revalidate
        ? {}
        : { cache: 'no-store' }),
      signal: controller.signal,
      ...(Object.keys(headers).length ? { headers } : {}),
      method: (options.method as any) ?? 'GET',
    });
    if (!res.ok) throw new Error((await res.json()).message.toString());
    return res.json() as T;
  };
}
