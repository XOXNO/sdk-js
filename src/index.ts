import { CollectionModule } from './collection';
import { APIClient } from './utils/api';
import { API_URL } from './utils/const';

/**
 * Represents an XOXNO Marketplace SDK, providing a simplified interface for
 * interacting with an XOXNO API.
 */
export class XOXNO {
  public collection: CollectionModule;
  /**
   * Creates a new XOXNO instance.
   * @param apiUrl - The base URL of the XOXNO API.
   * @param apiKey - The API key for accessing the XOXNO API.
   */
  constructor(apiUrl: string = API_URL, apiKey = '') {
    APIClient.init(apiUrl, apiKey);
    this.collection = new CollectionModule();
  }
}
