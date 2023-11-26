import {
  TradincActivityArgs,
  TradingActivityResponse,
  TradingActivityQueryFilter,
} from '../types/trading';
import XOXNOClient from '../utils/api';

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
      collection: args.collections,
      identifier: args.identifiers || undefined,
      address: args.wallets || undefined,
      tokens: args.placedInToken || undefined,
      marketplace: args.marketplaces || undefined,
      action: args.actions || undefined,
      range: args.priceRange,
      rankRange: args.rankRange,
      timestampRange: args.timestampRange,
      attributes: args.attributes,
    },
    orderBy: args.orderBy,
    select: args.select,
    top: args.top || 35,
    skip: args.skip || 0,
  };

  const buffer = Buffer.from(JSON.stringify(payloadBody)).toString('base64');
  const response = await api.fetchWithTimeout<TradingActivityResponse>(
    `/getTradingActivity/${buffer}`,
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
