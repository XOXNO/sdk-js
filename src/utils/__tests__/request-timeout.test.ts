import { DEFAULT_REQUEST_TIMEOUT_MS, XOXNOClient } from '../api'

// `fetchWithTimeout` used to set no signal at all — the name promised a
// deadline the implementation never had, so a stalled response was bounded only
// by the host runtime. These pin the contract: reads are deadlined, bodies are
// not (their duration is uplink-bound), and a caller's own signal survives.
describe('fetchWithTimeout deadline', () => {
  const realFetch = globalThis.fetch
  let seen: RequestInit | undefined

  beforeEach(() => {
    seen = undefined
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      seen = init
      return new Response('{}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  const client = () => new XOXNOClient({ apiUrl: 'https://api.example.com' })

  it('deadlines a bodyless read', async () => {
    await client().fetchWithTimeout('/read')
    expect(seen?.signal).toBeInstanceOf(AbortSignal)
    expect(seen?.signal?.aborted).toBe(false)
  })

  it('leaves a request with a body unbounded by default', async () => {
    await client().fetchWithTimeout('/upload', {
      method: 'PUT',
      body: new Uint8Array([1, 2, 3]),
    })
    expect(seen?.signal).toBeUndefined()
  })

  it('honours an explicit timeout on a request with a body', async () => {
    await client().fetchWithTimeout('/upload', {
      method: 'PUT',
      body: new Uint8Array([1, 2, 3]),
      timeout: 1_000,
    })
    expect(seen?.signal).toBeInstanceOf(AbortSignal)
  })

  it('lets timeout: 0 opt a read out', async () => {
    await client().fetchWithTimeout('/read', { timeout: 0 })
    expect(seen?.signal).toBeUndefined()
  })

  it('takes the client-wide default and the per-call override', async () => {
    const scoped = new XOXNOClient({
      apiUrl: 'https://api.example.com',
      timeout: 0,
    })
    await scoped.fetchWithTimeout('/read')
    expect(seen?.signal).toBeUndefined()

    await scoped.fetchWithTimeout('/read', { timeout: 5_000 })
    expect(seen?.signal).toBeInstanceOf(AbortSignal)
  })

  it('still aborts when the caller cancels', async () => {
    const controller = new AbortController()
    await client().fetchWithTimeout('/read', { signal: controller.signal })
    expect(seen?.signal?.aborted).toBe(false)
    controller.abort()
    expect(seen?.signal?.aborted).toBe(true)
  })

  it('aborts a read that never responds', async () => {
    globalThis.fetch = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(init.signal?.reason)
        )
      })) as typeof fetch

    await expect(
      client().fetchWithTimeout('/hangs-forever', { timeout: 20 })
    ).rejects.toThrow()
  })

  it('keeps the default long enough not to trip a working read', () => {
    expect(DEFAULT_REQUEST_TIMEOUT_MS).toBeGreaterThanOrEqual(10_000)
  })
})
