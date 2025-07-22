import { EventUserRoles } from '@xoxno/types/enums'

import { buildSdk } from '.'
import { XOXNOClient } from '../utils/api'
import { endpoints } from './swagger'
import { coveredMethods } from './utils'

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

  const entries = Object.entries(endpoints)

  console.log(
    /* bar({}),
    bar.claim({}),
    foo({}),
    foo.claim({}) */
    sdk.event.eventId('123').guest.address('123')()
    /* sdk.event.eventId('123')(),
    sdk.event.eventId('123').profile.PUT({}),
    sdk.event.eventId('123').background.PUT({}),
    sdk.event.eventId('123').description.PUT({}),
    sdk.event.eventId('123').description.image.imageId('123').DELETE({}),
    sdk.event.eventId('123').register.POST({}),
    sdk.event.eventId('123').ticket.ticketId('123')(),
    sdk.event.eventId('123').ticket.ticketId('123').PATCH({}),
    sdk.user.chat.conversation(),
    sdk.user.chat.conversation.conversationId('123')({}),
    sdk.user.chat.conversation.conversationId('123').DELETE({}),
    sdk.user.chat.conversation
      .conversationId('123')
      .message.messageId('123')
      .DELETE({}) */
    /* entries
      .filter(([key, value]) => {
        return key.split('/').pop()?.startsWith(':')
      })
      .flatMap(([key, value]) => {
        const match = entries.filter(([key2, value2]) => {
          return (
            key !== key2 &&
            key2.startsWith(key) &&
            coveredMethods.some((method) => {
              return method in value2
            }) &&
            endpoints[key2 as keyof typeof endpoints].output === null
          )
        })
        return match.map((item) => item[0])
      }) */
    /* sdk.user.chat.conversation
      .conversationId('123')
      .message.messageId('123')
      .DELETE({ auth: '' }),
    sdk.user.chat.conversation.conversationId('123')({
      receiver: '',
      auth: '',
    }),
    sdk.event
      .eventId('123')
      .description.image.imageId('123')
      .DELETE({ auth: '' }),
    sdk.event
      .eventId('123')
      .description.PUT({ body: new FormData(), auth: '' }),
    sdk.event.eventId('123').invite.inviteId('123')() */
    /* sdk.event.eventId('123').invite.inviteId('456'),
    sdk.event
      .eventId('123')
      .invite.inviteId('456')
      .claim.POST({ body: {} })
      .catch(() => null),
    sdk.nft.identifier('EAPES-8f3c1f-08b8')(),
    sdk.nft
      .identifier('123')
      .like.POST({ body: {} })
      .catch(() => null),
    sdk.user.lending.image.nonce('123')() */
    /* el.claim.POST({
      body: {
        callbackUrl: {
          success: '',
          error: '',
          successClose: '',
          errorClose: '',
        },
        ticketSelections: [],
        questionAnswers: [],
      },
      auth: '',
    }) */
    // sdk.collection.collection('123').floorPrice()
  )
}

_fn()
