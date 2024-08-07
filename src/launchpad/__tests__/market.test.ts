import { LaunchpadModule } from '..'
import { XOXNOClient } from '../../utils/api'

describe('SCInteraction', () => {
  let sc: LaunchpadModule
  beforeAll(async () => {
    XOXNOClient.init()
    sc = await LaunchpadModule.init(
      'erd1qqqqqqqqqqqqqpgqtwtp5uz97u232zvzd973upqxwe2xnqv2ys5s3c7jx9'
    )
  })

  beforeEach(async () => {
    return new Promise((resolve) => setTimeout(resolve, 1000))
  })

  it('should return all the unique tags of the launchpad SC', async () => {
    const tags = await sc.getAllUniqueTags()
    expect(tags).toBeDefined()
    expect(tags).toContain('Elonverse')
  })

  it('should return all the unique stages of a collection from the launchpad SC', async () => {
    const tags = await sc.getStages('Elonverse')
    expect(tags).toBeDefined()
  })
})
