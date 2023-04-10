import { LaunchpadModule } from '../index';
import { APIClient } from '../../utils/api';

describe('SCInteraction', () => {
  let sc: LaunchpadModule;
  beforeAll(async () => {
    APIClient.init();
    sc = await LaunchpadModule.init(
      'erd1qqqqqqqqqqqqqpgqtwtp5uz97u232zvzd973upqxwe2xnqv2ys5s3c7jx9'
    );
  });

  it('should return all the unique tags of the launchpad SC', async () => {
    const tags = await sc.getAllUniqueTags();
    expect(tags).toBeDefined();
    expect(tags).toContain('Elonverse');
  });

  it('should return all the unique stages of a collection from the launchpad SC', async () => {
    const tags = await sc.getStages('Elonverse');
    expect(tags).toBeDefined();
    // expect(tags).toContain('Elonverse');
    // console.log(tags);
  });
});
