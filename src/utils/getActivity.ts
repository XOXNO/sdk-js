import { XOXNOClient } from '..';
import {
  TradincActivityArgs,
  TradingActivityResponse,
  TradingActivityQueryFilter,
} from '../types/trading';

/**
 * Fetches the trading activity of the given collections
 * @param args - The trading activity arguments
 * @param api - The API client
 * @returns - The trading activity response
 * @throws - If the top is greater than 35
 */
export const getActivity = async (
  args: TradincActivityArgs,
  api: XOXNOClient
): Promise<TradingActivityResponse> => {
  if (args.top && args.top > 35) {
    throw new Error('Top cannot be greater than 35');
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
      from: args.from,
      to: args.to,
      activityAddress: args.wallets || undefined,
      // tokens: args.placedInToken || undefined,
      source: args.source || undefined,
      activityType: args.activityType || undefined,
      // range: args.priceRange,
      // rankRange: args.rankRange,
      // timestampRange: args.timestampRange,
      // attributes: args.attributes,
    },
    strictSelect: args.strictSelect,
    orderBy: args.orderBy,
    select: args.select,
    top: args.top || 35,
    skip: args.skip || 0,
  };

  const buffer = Buffer.from(JSON.stringify(payloadBody)).toString('base64');
  const response = await api.fetchWithTimeout<TradingActivityResponse>(
    `/activity/${buffer}/query`,
    {
      next: {
        tags: ['getActivity'],
        revalidate: 180,
      },
    }
  );

  return {
    ...response,
    getNextPagePayload: {
      ...args,
      skip: (args.skip ?? 0) + (args.top ?? 35),
    },
    empty: response.resources.length === 0,
  };
};
