import type {
  TradincActivityArgs,
  TradingActivityQueryFilter,
  TradingActivityResponse,
} from '../types/trading'
import type { XOXNOClient } from './api'

/**
 * Fetches the trading activity of the given collections
 * @param args - The trading activity arguments
 * @param api - The API client
 * @returns - The trading activity response
 * @throws - If the top is greater than 100
 */
export const getActivity = async (
  args: TradincActivityArgs,
  api: XOXNOClient
): Promise<TradingActivityResponse> => {
  if (args.top && args.top > 100) {
    throw new Error('Top cannot be greater than 100')
  }

  const ranges = []
  if (args.priceRange) {
    ranges.push({
      ...args.priceRange,
      field: 'activityData.egldValue',
    })
  }
  if (args.timestampRange) {
    ranges.push({
      ...args.timestampRange,
      field: 'timestamp',
    })
  }

  const payloadBody: TradingActivityQueryFilter = {
    filters: {
      activityData:
        args.from == null && args.to == null
          ? {
              collection: args.collections,
              identifier: args.identifiers || undefined,
            }
          : undefined,
      chain: args.chain,
      from: args.from,
      to: args.to,
      activityAddress: args.wallets || undefined,
      source: args.source || undefined,
      activityType: args.activityType || undefined,
      eventIdentifier: args.eventIdentifier || undefined,
      range: ranges,
    },
    strictSelect: args.strictSelect,
    includeCount: args.includeCount || false,
    orderBy: args.orderBy,
    select: args.select,
    top: args.top || 35,
    skip: args.skip || 0,
  }

  const response = await api.fetchWithTimeout<TradingActivityResponse>(
    `/activity/query`,
    {
      params: {
        filter: JSON.stringify(payloadBody),
      },
    }
  )

  return {
    ...response,
  }
}
