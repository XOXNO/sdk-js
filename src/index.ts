import { APIClient } from './utils/api';
import { API_URL } from './utils/const';

/**
 * Represents an XOXNO Marketplace SDK, providing a simplified interface for
 * interacting with an XOXNO API.
 */
export class XOXNO {
  /**
   * Creates a new XOXNO instance.
   * @param apiUrl - The base URL of the XOXNO API.
   * @param apiKey - The API key for accessing the XOXNO API.
   */
  constructor(apiUrl: string = API_URL, apiKey = '') {
    APIClient.init(apiUrl, apiKey);
  }
}

export * from './types';
export * from './collection';
export * from './launchpad';
export * from './interactions';
export * from './nft';
