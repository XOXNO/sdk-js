import { EventUserRoles } from '@xoxno/types/enums'

import { buildSdk } from '.'
import { XOXNOClient } from '../utils/api'

async function _fn() {
  XOXNOClient.init()

  const sdk = buildSdk(XOXNOClient.getInstance())

  const result = await Promise.all([
    sdk.user.me.event.badge({ auth: '' }).catch(() => null),
    sdk.user.me.event({ extended: true, auth: '' }).catch(() => null),
    sdk.collection
      .creatorTag('MiceCityClub')
      .collectionTag('MiceCity')
      .dropInfo(),
    sdk.collection.collection('EAPES-8f3c1f').floorPrice(),
    sdk.notify.globalBroadcast
      .POST({
        body: {
          eventId: '',
          metadata: {},
          targetAddresses: [],
          title: '',
          message: '',
        },
        auth: '',
      })
      .catch(() => null),
    sdk.user.lending.image.nonce('123')(),
    sdk.liquid.egld.staked(),
    sdk.activity.query({
      filter: {
        filters: {
          activityData: {
            collection: ['test'],
          },
        },
        orderBy: ['activityData.price asc'],
        top: 35,
      },
    }),
    sdk.event
      .eventId('123')
      .role.POST({
        body: {
          permissions: [],
          endTime: 0,
          role: [EventUserRoles.CHECK_IN_MANAGER],
          name: '',
        },
        auth: '',
      })
      .catch(() => null),
  ])

  console.log(
    await sdk.collection.stats.query({
      filter: { skip: 0, top: 1, filters: {} },
    })
  )
}

_fn()
