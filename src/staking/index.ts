import { StakingSummaryPools } from '../types/staking';
import { XOXNOClient } from '../utils/api';

export class StakingModule {
  private api: XOXNOClient;
  constructor() {
    this.api = XOXNOClient.getInstance();
  }
  /** Gets pool details
   * @param {number} poolId - User's address
   * @returns {CreatoPoolDetailsrInfo} User's creator info
   * @throws {Error} Throws an error if the address is invalid
   *  */
  public getPoolDetails = async (
    poolId: number
  ): Promise<StakingSummaryPools> => {
    const response = await this.api.fetchWithTimeout<StakingSummaryPools>(
      `/pool/${poolId}/profile`
    );
    return response;
  };
}
