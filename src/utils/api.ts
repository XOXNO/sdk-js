export class APIClient {
  private static instance: APIClient;
  private apiUrl: string;
  private apiKey: string;

  private constructor(apiUrl: string, apiKey: string) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
  }

  public static init(apiUrl: string, apiKey: string): APIClient {
    if (!APIClient.instance) {
      APIClient.instance = new APIClient(apiUrl, apiKey);
    }
    return APIClient.instance;
  }

  public static getClient(): APIClient {
    if (!APIClient.instance) {
      throw new Error('APIClient has not been initialized');
    }
    return APIClient.instance;
  }
  public fetchWithTimeout = async (
    path: string,
    options: Record<string, unknown> = {},
    timeout = 40000
  ) => {
    const controller = new AbortController();
    const { signal } = controller as any;

    const timestamp = Math.round(new Date().getTime() / 1000);
    const handle = setTimeout(() => {
      controller.abort();
    }, timeout);

    let response;

    const headers = {
      'Accept-Encoding': 'gzip,deflate,br',
      'xo-time': `Sent-At:${timestamp}`,
      Referer: 'https://xoxno.dev',
      'User-Agent': 'XOXNO/1.0/SDK',
      ...(options.method === 'POST'
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...((options.headers as object) ?? {}),
    };
    try {
      response = await fetch(
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
          signal,
          ...options,
          ...(Object.keys(headers).length ? { headers } : {}),
          method: (options.method as any) ?? 'GET',
        }
      );

      if (!response.ok) {
        await response?.text().then((text) => {
          throw new Error(text);
        });
      }

      clearTimeout(handle);

      const result = await response.json();

      return result;
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
