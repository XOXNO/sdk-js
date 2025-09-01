# XOXNO SDK

## Installation

```bash
npm install @xoxno/sdk-js
```

## Basic usage

```typescript
import { cache } from 'react'

import { buildSdk, XOXNOClient } from '@xoxno/sdk-js'

// You can safely call `getSdk()` wherever you need it
export const getSdk = cache(() => {
  return buildSdk(new XOXNOClient())
})
```

```typescript
import { getSdk } from './get-sdk'

async function main() {
  /* Calling public endpoints ✅ */

  const trendingCollections = await getSdk().collection.query({
    filter: {
      top: 10,
      orderBy: ['statistics.tradeData.weekEgldVolume desc'],
      filters: {
        isVerified: true,
      },
    },
  })

  console.log(trendingCollections.resources) // CollectionProfileDoc[]

  const collectionProfile = await getSdk()
    .collection.collection('BOOGAS-afc98d')
    .profile()

  console.log(collectionProfile.description) // string

  // ... and many more!
}

main()
```

## Calling restricted endpoints

Apart from the public endpoints that anyone can call, The XOXNO SDK also exposes `POST`, `PUT`, `PATCH` and `DELETE` endpoints that can be called by the respective logged in user. Here's how a flow looks like that obtains a **XOXNO Auth Token** when logging in with a MultiversX wallet, that can be used for 24h to make authenticated requests:

```typescript
import { getSdk } from './get-sdk'

export class NativeAuthClient {
  async initialize(extraInfo: object) {
    const token = await getSdk().user.nativeToken({
      originalUrl: 'https://your-domain.com',
      extraInfo: JSON.stringify({
        ...extraInfo,
        timestamp: Date.now(),
        // ... and any other properties you want to have encoded in the JWT for your later usage
      }),
    })

    return { token }
  }
  getToken({
    address,
    token,
    signature,
  }: {
    address: string
    token: string
    signature: string | undefined
  }) {
    const encodedAddress = this.encodeValue(address)

    const encodedToken = this.encodeValue(token)

    const loginToken = `${encodedAddress}.${encodedToken}.${signature}`

    return { loginToken }
  }
  private encodeValue(str: string) {
    return this.escape(Buffer.from(str, 'utf8').toString('base64'))
  }
  private escape(str: string) {
    return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  }
}
```

```typescript
import { ExtensionProvider } from '@multiversx/sdk-extension-provider'
import { WalletClientType } from '@xoxno/types/enums'
import { setCookie } from 'cookies-next'

import { getSdk } from './get-sdk'
import { NativeAuthClient } from './native-auth'

async function main() {
  const provider = ExtensionProvider.getInstance()

  await provider.init()

  const nativeAuthClient = new NativeAuthClient()

  const loginMethod = WalletClientType.EXTENSION

  const { token } = await nativeAuthClient.initialize({
    loginMethod,
  })

  const { address, signature } = await provider.login({ token })

  const { loginToken } = nativeAuthClient.getToken({
    address,
    token,
    signature,
  })

  const { access_token, expires } = await getSdk().user.login.POST({
    body: {
      loginToken,
      signature,
      address,
    },
  })

  // store the access_token for later usage
  setCookie('xoxno-auth', access_token, {
    expires: new Date(expires * 1000),
    sameSite: 'strict',
    secure: true,
  })

  // from now on you can call protected endpoints on behalf of `address`

  const newUserProfile = await getSdk()
    .user.address(address)
    .profile.PATCH({
      body: {
        description: 'XOXNO SDK rocks!',
      },
      auth: access_token,
    })

  console.log(newUserProfile.description) // XOXNO SDK rocks!
}

main()
```

## List of endpoints to call

The list of available SDK endpoints gets extracted from https://api.xoxno.com/swagger.yaml and parsed into a Typescript definition that you can [view here](https://github.com/XOXNO/sdk-js/blob/alpha/src/sdk/swagger.ts)

`buildSdk` then converts them in the following way:

```typescript
// /collection/:collection/profile
sdk.collection.collection('BOOGAS-afc98d').profile()

// /drops/:creatorTag/:collectionTag/drop-info
sdk.drops.creatorTag('MiceCityClub').collectionTag('MiceCity').dropInfo()
```

For your reference, here is a list of all endpoints that are available:

```typescript
// GET /activity/query
sdk.activity.query(...); // NftActivityPaginated

// GET /activity/:identifier
sdk.activity.identifier("...")(...); // NftActivityDocHydrated

// GET /analytics/marketplace-unique-users
sdk.analytics.marketplaceUniqueUsers(...); // AnalyticsMarketplaceUniqueUsers[]

// GET /analytics/volume
sdk.analytics.volume(...); // VolumeGraph[]

// GET /analytics/overview
sdk.analytics.overview(...); // GlobalAnalyticsOverviewResponseDto

// GET /arda/max-token-quantity
sdk.arda.maxTokenQuantity(...); // ArdaSwapResultDto

// GET /arda/min-token-quantity
sdk.arda.minTokenQuantity(...); // ArdaSwapResultDto

// GET /ash/min-token-quantity
sdk.ash.minTokenQuantity(...); // FetchSwapRoutesResponseDto

// GET /ash/max-token-quantity
sdk.ash.maxTokenQuantity(...); // FetchSwapRoutesResponseDto

// GET /collection/:collection/attributes
sdk.collection.collection("...").attributes(...); // Record<string, ValueFp & Record<string, TraitInfo>>

// GET /collection/:collection/ranks
sdk.collection.collection("...").ranks(...); // CollectionRanksDTO[]

// GET /collection/:collection/listings
sdk.collection.collection("...").listings(...); // ListingsResponseDto

// POST /collection/:collection/sign-offer
sdk.collection.collection("...").signOffer.POST(...); // SignDataDto

// POST /collection/:collection/sign-mint
sdk.collection.collection("...").signMint.POST(...); // SignDataDto

// GET /collection/:collection/profile
sdk.collection.collection("...").profile(...); // CollectionProfileDoc

// PATCH /collection/:collection/profile
sdk.collection.collection("...").profile.PATCH(...); // CollectionProfileDoc

// GET /collection/:collection/floor-price
sdk.collection.collection("...").floorPrice(...); // FloorPriceDto

// GET /collection/floor-price
sdk.collection.floorPrice(...); // Record<string, number>

// GET /collection/pinned
sdk.collection.pinned(...); // PinnedCollectionDto[]

// GET /collection/pinned-drops
sdk.collection.pinnedDrops(...); // CollectionMintProfileDocHydrated[]

// GET /collection/:collection/pinned-drops
sdk.collection.collection("...").pinnedDrops(...); // CollectionPinnedStatusDto

// GET /collection/:collection/pinned
sdk.collection.collection("...").pinned(...); // CollectionPinnedStatusDto

// POST /collection/:collection/follow
sdk.collection.collection("...").follow.POST(...); // FollowCollectionDto

// GET /collection/query
sdk.collection.query(...); // CollectionProfilePaginated

// GET /collection/drops/query
sdk.collection.drops.query(...); // CollectionMintProfilePaginated

// GET /collection/:collection/drop-info
sdk.collection.collection("...").dropInfo(...); // CollectionMintProfileDocWithStages

// GET /collection/:creatorTag/:collectionTag/drop-info
sdk.collection.creatorTag("...").collectionTag("...").dropInfo(...); // CollectionMintProfileDocWithStages

// PUT /collection/:collection/upload-picture
sdk.collection.collection("...").uploadPicture.PUT(...); // CollectionProfileDoc

// PUT /collection/:collection/upload-banner
sdk.collection.collection("...").uploadBanner.PUT(...); // CollectionProfileDoc

// PUT /collection/:collection/reset-picture
sdk.collection.collection("...").resetPicture.PUT(...); // CollectionProfileDoc

// PUT /collection/:collection/reset-banner
sdk.collection.collection("...").resetBanner.PUT(...); // CollectionProfileDoc

// GET /collection/:collection/holders
sdk.collection.collection("...").holders(...); // CollectionHoldersDto

// GET /collection/:collection/holders/export
sdk.collection.collection("...").holders.export(...); // CollectionHoldersExportDto[]

// GET /collection/:collection/owner
sdk.collection.collection("...").owner(...); // CollectionOwnerDto

// GET /collection/:collection/stats
sdk.collection.collection("...").stats(...); // CollectionStatsDocHydrated

// GET /collection/stats/query
sdk.collection.stats.query(...); // CollectionStatsPaginated

// GET /collection/global-offer/query
sdk.collection.globalOffer.query(...); // GlobalOfferPaginated

// GET /collection/:collection/staking/summary
sdk.collection.collection("...").staking.summary(...); // StakingSummary[]

// GET /collection/:collection/staking/delegators
sdk.collection.collection("...").staking.delegators(...); // string[]

// GET /collection/staking/explore
sdk.collection.staking.explore(...); // StakingExploreDtoHydrated[]

// GET /collection/search
sdk.collection.search(...); // GlobalSearchResourcesPaginated

// GET /collection/drops/search
sdk.collection.drops.search(...); // CollectionMintProfilePaginated

// GET /collection/:collection/analytics/volume
sdk.collection.collection("...").analytics.volume(...); // AnalyticsVolumeDto[]

// GET /countries
sdk.countries(...); // string[]

// POST /event
sdk.event.POST(...); // EventProfile

// GET /event/:eventId
sdk.event.eventId("...")(...); // EventProfile

// PATCH /event/:eventId
sdk.event.eventId("...").PATCH(...); // EventProfile

// GET /event/profile/query
sdk.event.profile.query(...); // EventProfileQuery

// PUT /event/:eventId/profile
sdk.event.eventId("...").profile.PUT(...); // EventProfile

// PUT /event/:eventId/background
sdk.event.eventId("...").background.PUT(...); // EventProfile

// PUT /event/:eventId/description
sdk.event.eventId("...").description.PUT(...); // EventProfile

// PUT /event/:eventId/description/image
sdk.event.eventId("...").description.image.PUT(...); // string

// DELETE /event/:eventId/description/image/:imageId
sdk.event.eventId("...").description.image.imageId("...").DELETE(...); // SuccessDto

// POST /event/:eventId/register
sdk.event.eventId("...").register.POST(...); // EventRegistrationResponseDto

// GET /event/:eventId/ticket
sdk.event.eventId("...").ticket(...); // EventTicketProfileDoc[]

// POST /event/:eventId/ticket
sdk.event.eventId("...").ticket.POST(...); // EventTicketProfileDoc

// GET /event/:eventId/ticket/:ticketId
sdk.event.eventId("...").ticket.ticketId("...")(...); // EventTicketProfileDoc

// POST /event/:eventId/ticket/:ticketId
sdk.event.eventId("...").ticket.ticketId("...").POST(...); // SuccessDto

// PATCH /event/:eventId/ticket/:ticketId
sdk.event.eventId("...").ticket.ticketId("...").PATCH(...); // EventTicketProfileDoc

// PUT /event/:eventId/ticket/:ticketId
sdk.event.eventId("...").ticket.ticketId("...").PUT(...); // EventTicketProfileDoc

// GET /event/:eventId/stage
sdk.event.eventId("...").stage(...); // EventStageProfileDoc[]

// POST /event/:eventId/stage
sdk.event.eventId("...").stage.POST(...); // EventStageProfileDoc

// GET /event/:eventId/stage/:stageId
sdk.event.eventId("...").stage.stageId("...")(...); // EventStageProfileDoc

// PATCH /event/:eventId/stage/:stageId
sdk.event.eventId("...").stage.stageId("...").PATCH(...); // EventStageProfileDoc

// DELETE /event/:eventId/stage/:stageId
sdk.event.eventId("...").stage.stageId("...").DELETE(...); // SuccessDto

// POST /event/:eventId/calculate-prices
sdk.event.eventId("...").calculatePrices.POST(...); // TicketPricesResponse

// POST /event/:eventId/validate-discount
sdk.event.eventId("...").validateDiscount.POST(...); // DiscountCodeValidationResponse

// POST /event/:eventId/invite
sdk.event.eventId("...").invite.POST(...); // EventInvitationDoc[]

// GET /event/:eventId/invite/query
sdk.event.eventId("...").invite.query(...); // EventInvitationQuery

// GET /event/:eventId/invite/:inviteId
sdk.event.eventId("...").invite.inviteId("...")(...); // EventInvitation

// POST /event/:eventId/invite/:inviteId
sdk.event.eventId("...").invite.inviteId("...").POST(...); // EventAcceptInvitation

// DELETE /event/:eventId/invite/:inviteId
sdk.event.eventId("...").invite.inviteId("...").DELETE(...); // EventInvitationDoc

// GET /event/:eventId/voucher/query
sdk.event.eventId("...").voucher.query(...); // EventVoucherQuery

// GET /event/:eventId/questions
sdk.event.eventId("...").questions(...); // EventQuestionDoc[]

// POST /event/:eventId/question
sdk.event.eventId("...").question.POST(...); // EventQuestionDoc

// PATCH /event/:eventId/question/:questionId
sdk.event.eventId("...").question.questionId("...").PATCH(...); // EventQuestionDoc

// DELETE /event/:eventId/question/:questionId
sdk.event.eventId("...").question.questionId("...").DELETE(...); // SuccessDto

// GET /event/:eventId/guest/query
sdk.event.eventId("...").guest.query(...); // EventGuestProfileQuery

// GET /event/:eventId/guest/:address
sdk.event.eventId("...").guest.address("...")(...); // EventGuestProfile

// GET /event/:eventId/guest-export
sdk.event.eventId("...").guestExport(...); // EventGuestExport[]

// GET /event/:eventId/role
sdk.event.eventId("...").role(...); // EventUserRole[]

// POST /event/:eventId/role
sdk.event.eventId("...").role.POST(...); // EventUserRole

// PATCH /event/:eventId/role
sdk.event.eventId("...").role.PATCH(...); // EventUserRole

// GET /event/:eventId/role/:roleId
sdk.event.eventId("...").role.roleId("...")(...); // EventUserRoleDoc

// POST /event/:eventId/role/:roleId
sdk.event.eventId("...").role.roleId("...").POST(...); // EventUserRoleDoc

// DELETE /event/:eventId/role/:roleId
sdk.event.eventId("...").role.roleId("...").DELETE(...); // SuccessDto

// DELETE /event/:eventId/guest
sdk.event.eventId("...").guest.DELETE(...); // SuccessDto

// GET /event/:eventId/role/:address
sdk.event.eventId("...").role.address("...")(...); // EventUserRoleDoc

// POST /event/:eventId/scan
sdk.event.eventId("...").scan.POST(...); // TicketValidationResult

// POST /event/:eventId/voucher
sdk.event.eventId("...").voucher.POST(...); // EventVoucherDoc

// PATCH /event/:eventId/voucher/:voucherCode
sdk.event.eventId("...").voucher.voucherCode("...").PATCH(...); // EventVoucherDoc

// DELETE /event/:eventId/voucher/:voucherCode
sdk.event.eventId("...").voucher.voucherCode("...").DELETE(...); // EventVoucherDoc

// POST /event/:eventId/manual-check-in
sdk.event.eventId("...").manualCheckIn.POST(...); // TicketValidationResult

// GET /event/:eventId/answered-questions/:address
sdk.event.eventId("...").answeredQuestions.address("...")(...); // AnsweredQuestionWithDetails[]

// PATCH /event/:eventId/guest/approve
sdk.event.eventId("...").guest.approve.PATCH(...); // EventGuestProfile[]

// GET /event/:eventId/google-pass/:address
sdk.event.eventId("...").googlePass.address("...")(...); // string[]

// GET /event/profile/location
sdk.event.profile.location(...); // EventCountGroupedByCountry[]

// POST /event/:eventId/referral-config
sdk.event.eventId("...").referralConfig.POST(...); // EventReferralConfigDoc

// PATCH /event/:eventId/referral-config/:configId
sdk.event.eventId("...").referralConfig.configId("...").PATCH(...); // EventReferralConfigDoc

// DELETE /event/:eventId/referral-config/:configId
sdk.event.eventId("...").referralConfig.configId("...").DELETE(...); // EventReferralConfigDoc

// GET /event/:eventId/referral-configs
sdk.event.eventId("...").referralConfigs(...); // EventReferralConfigPaginated

// POST /event/:eventId/referral
sdk.event.eventId("...").referral.POST(...); // EventReferralDoc

// PATCH /event/:eventId/referral/:referralCode
sdk.event.eventId("...").referral.referralCode("...").PATCH(...); // EventReferralDoc

// DELETE /event/:eventId/referral/:referralCode
sdk.event.eventId("...").referral.referralCode("...").DELETE(...); // EventReferralDoc

// GET /event/:eventId/referrals
sdk.event.eventId("...").referrals(...); // EventReferralPaginated

// GET /event/:eventId/referrals/self-serviced
sdk.event.eventId("...").referrals.selfServiced(...); // EventReferralDoc[]

// POST /event/:eventId/notify-attendees
sdk.event.eventId("...").notifyAttendees.POST(...); // SuccessWithMessageDto

// POST /eventNotifications/event/:eventId/update
sdk.eventNotifications.event.eventId("...").update.POST(...); // NotificationSuccessResponseDto

// POST /eventNotifications/event/:eventId/reminder
sdk.eventNotifications.event.eventId("...").reminder.POST(...); // NotificationSuccessResponseDto

// POST /eventNotifications/creator/marketing
sdk.eventNotifications.creator.marketing.POST(...); // NotificationSuccessResponseDto

// POST /eventNotifications/user/:userId/direct
sdk.eventNotifications.user.userId("...").direct.POST(...); // NotificationSuccessResponseDto

// POST /faucet
sdk.faucet.POST(...); // SuccessDto

// GET /launchpad/:scAddress/shareholders/royalties
sdk.launchpad.scAddress("...").shareholders.royalties(...); // ShareholderDto[]

// GET /launchpad/:scAddress/shareholders/collection/:collectionTag
sdk.launchpad.scAddress("...").shareholders.collection.collectionTag("...")(...); // ShareholderDto[]

// GET /lending/market/:token/profile
sdk.lending.market.token("...").profile(...); // LendingMarketProfile

// GET /lending/market/query
sdk.lending.market.query(...); // LendingMarketProfileQuery

// GET /lending/market/indexes
sdk.lending.market.indexes(...); // Record<string, LendingIndexesDto>

// GET /lending/market/emode-categories
sdk.lending.market.emodeCategories(...); // LendingEModeCategoryProfile[]

// GET /lending/market/:token/emode-categories
sdk.lending.market.token("...").emodeCategories(...); // LendingEModeCategoryProfile[]

// GET /lending/market/:token/analytics
sdk.lending.market.token("...").analytics(...); // LendingMarketAnalyticsGraph[]

// GET /lending/leaderboard
sdk.lending.leaderboard(...); // LendingPositionStatus[]

// GET /lending/leaderboard/liquidate
sdk.lending.leaderboard.liquidate(...); // LendingPositionStatus[]

// GET /lending/leaderboard/clean-bad-debt
sdk.lending.leaderboard.cleanBadDebt(...); // LendingPositionStatus[]

// GET /lending/stats
sdk.lending.stats(...); // LendingOverallStats

// GET /lending/market/prices
sdk.lending.market.prices(...); // Record<string, number>

// GET /lending/market-sc
sdk.lending.marketSc(...); // string[]

// GET /lending/active-accounts
sdk.lending.activeAccounts(...); // number[]

// GET /lending/account/:nonce/attributes
sdk.lending.account.nonce("...").attributes(...); // LendingNftAttributes

// GET /lending/account/:nonce/positions
sdk.lending.account.nonce("...").positions(...); // LendingNftAttributes[]

// GET /lending/market/:token/price/egld
sdk.lending.market.token("...").price.egld(...); // LendingTokenPriceDto

// GET /liquid/xoxno/stats
sdk.liquid.xoxno.stats(...); // XoxnoLiquidStatsDto

// GET /liquid/egld/stats
sdk.liquid.egld.stats(...); // XoxnoLiquidStatsDto

// GET /liquid/xoxno/rate
sdk.liquid.xoxno.rate(...); // RateType

// GET /liquid/xoxno/liquid-supply
sdk.liquid.xoxno.liquidSupply(...); // string

// GET /liquid/xoxno/staked
sdk.liquid.xoxno.staked(...); // string

// GET /liquid/egld/rate
sdk.liquid.egld.rate(...); // RateType

// GET /liquid/egld/liquid-supply
sdk.liquid.egld.liquidSupply(...); // string

// GET /liquid/egld/staked
sdk.liquid.egld.staked(...); // string

// GET /liquid/egld/pending-fees
sdk.liquid.egld.pendingFees(...); // string

// GET /liquid/egld/pending-undelegate
sdk.liquid.egld.pendingUndelegate(...); // string

// GET /liquid/egld/pending-delegate
sdk.liquid.egld.pendingDelegate(...); // string

// GET /liquid/egld/execute-delegate
sdk.liquid.egld.executeDelegate(...); // string

// GET /liquid/egld/execute-undelegate
sdk.liquid.egld.executeUndelegate(...); // string

// GET /liquid/egld/protocol-apr
sdk.liquid.egld.protocolApr(...); // ProtocolAprType

// GET /liquid/egld/providers
sdk.liquid.egld.providers(...); // ProviderDto[]

// POST /mobile/device/register
sdk.mobile.device.register.POST(...); // MobileDeviceDoc

// GET /mobile/device/:deviceId
sdk.mobile.device.deviceId("...")(...); // MobileDeviceDoc

// DELETE /mobile/device/:deviceId
sdk.mobile.device.deviceId("...").DELETE(...); // SuccessDto

// GET /mobile/history
sdk.mobile.history(...); // PushNotificationResponse

// GET /mobile/history/unread-count
sdk.mobile.history.unreadCount(...); // PushNotificationCountResponse

// PUT /mobile/history/:notificationId/read
sdk.mobile.history.notificationId("...").read.PUT(...); // PushNotificationDoc

// PUT /mobile/history/read-all
sdk.mobile.history.readAll.PUT(...); // NotificationSuccessResponseDto

// DELETE /mobile/history/clear-all
sdk.mobile.history.clearAll.DELETE(...); // NotificationSuccessResponseDto

// DELETE /mobile/history/clear-id/:notificationId
sdk.mobile.history.clearId.notificationId("...").DELETE(...); // NotificationSuccessResponseDto

// GET /nft/query
sdk.nft.query(...); // NftPaginated

// POST /nft/:identifier/like
sdk.nft.identifier("...").like.POST(...); // LikeNftDto

// GET /nft/offer/query
sdk.nft.offer.query(...); // NftOfferPaginated

// GET /nft/offer/:identifier
sdk.nft.offer.identifier("...")(...); // NftOfferDocHydrated[]

// GET /nft/:identifier/offers
sdk.nft.identifier("...").offers(...); // NftOfferPaginated

// GET /nft/pinned
sdk.nft.pinned(...); // NftDocHydrated[]

// POST /nft/sign-withdraw
sdk.nft.signWithdraw.POST(...); // SignDataDto

// GET /nft/:identifier
sdk.nft.identifier("...")(...); // NftDocFull

// GET /nft/search/query
sdk.nft.search.query(...); // NftPaginated

// POST /notify/global-broadcast
sdk.notify.globalBroadcast.POST(...); // SuccessWithMessageDto

// GET /pool/:poolId/profile
sdk.pool.poolId("...").profile(...); // StakingSummary

// PATCH /pool/:poolId/profile
sdk.pool.poolId("...").profile.PATCH(...); // StakingPoolDoc

// GET /pool/:poolId/whitelist
sdk.pool.poolId("...").whitelist(...); // NftDocHydrated[]

// PUT /pool/:poolId/upload-picture
sdk.pool.poolId("...").uploadPicture.PUT(...); // StakingPoolDoc

// GET /search
sdk.search(...); // GlobalSearchResourcesPaginated

// GET /tokens
sdk.tokens(...); // TokenDataDocHydrated[]

// GET /tokens/swap
sdk.tokens.swap(...); // TokenDataDocHydrated[]

// GET /tokens/usd-price
sdk.tokens.usdPrice(...); // Record<string, number>

// GET /tokens/egld/fiat-price
sdk.tokens.egld.fiatPrice(...); // Record<string, number>

// GET /tokens/xoxno
sdk.tokens.xoxno(...); // IMetrics

// GET /tokens/egld
sdk.tokens.egld(...); // IMetrics

// GET /tokens/sui
sdk.tokens.sui(...); // IMetrics

// GET /tokens/xoxno/info
sdk.tokens.xoxno.info(...); // XoxnoInfo

// POST /transaction/cost
sdk.transaction.cost.POST(...); // TransactionCostData

// GET /transactions/:txHash
sdk.transactions.txHash("...")(...); // TransactionDetailed

// GET /transactions/:txHash/status
sdk.transactions.txHash("...").status(...); // TransactionProcessStatus

// POST /transactions
sdk.transactions.POST(...); // TransactionSendResult

// POST /transactions/batch
sdk.transactions.batch.POST(...); // TransactionSendResult[]

// GET /user/:address/network-account
sdk.user.address("...").networkAccount(...); // UserNetworkInfoDto

// GET /user/:address/token-inventory
sdk.user.address("...").tokenInventory(...); // UserTokenInventoryResponseDto

// POST /user/network-account
sdk.user.networkAccount.POST(...); // UserNetworkInfoDto[]

// GET /user/me/profile
sdk.user.me.profile(...); // UserProfileDoc

// GET /user/:address/profile
sdk.user.address("...").profile(...); // UserProfileDoc

// PATCH /user/:address/profile
sdk.user.address("...").profile.PATCH(...); // UserProfileDoc

// GET /user/me
sdk.user.me(...); // UserProfileDto

// GET /user/me/settings
sdk.user.me.settings(...); // UserSettingsDoc

// PATCH /user/me/settings/notification-preferences
sdk.user.me.settings.notificationPreferences.PATCH(...); // UserSettingsDoc

// PATCH /user/me/settings/email
sdk.user.me.settings.email.PATCH(...); // UserSettingsDoc

// DELETE /user/me/settings/email
sdk.user.me.settings.email.DELETE(...); // UserSettingsDoc

// PATCH /user/me/settings/phone
sdk.user.me.settings.phone.PATCH(...); // UserSettingsDoc

// PATCH /user/me/settings/billing
sdk.user.me.settings.billing.PATCH(...); // UserSettingsDoc

// POST /user/me/settings/verify-email
sdk.user.me.settings.verifyEmail.POST(...); // UserSettingsDoc

// POST /user/buy/signature
sdk.user.buy.signature.POST(...); // TradesilvaniaSignature

// PUT /user/:address/upload-picture
sdk.user.address("...").uploadPicture.PUT(...); // UserProfileDoc

// PUT /user/:address/upload-banner
sdk.user.address("...").uploadBanner.PUT(...); // UserProfileDoc

// PUT /user/:address/reset-picture
sdk.user.address("...").resetPicture.PUT(...); // UserProfileDoc

// PUT /user/:address/reset-banner
sdk.user.address("...").resetBanner.PUT(...); // UserProfileDoc

// GET /user/:tag/creator/is-registered
sdk.user.tag("...").creator.isRegistered(...); // SuccessDto

// GET /user/:address/creator/profile
sdk.user.address("...").creator.profile(...); // CreatorProfileDto

// PATCH /user/:address/creator/profile
sdk.user.address("...").creator.profile.PATCH(...); // CreatorProfileDoc

// PUT /user/:address/creator/upload-picture
sdk.user.address("...").creator.uploadPicture.PUT(...); // CreatorProfileDoc

// PUT /user/:address/creator/upload-banner
sdk.user.address("...").creator.uploadBanner.PUT(...); // CreatorProfileDoc

// PUT /user/:address/creator/reset-picture
sdk.user.address("...").creator.resetPicture.PUT(...); // CreatorProfileDoc

// PUT /user/:address/creator/reset-banner
sdk.user.address("...").creator.resetBanner.PUT(...); // CreatorProfileDoc

// GET /user/:address/favorite/collections
sdk.user.address("...").favorite.collections(...); // CollectionStatsPaginated

// GET /user/favorite/:favoriteId
sdk.user.favorite.favoriteId("...")(...); // CheckLikeStatusResponseDto

// POST /user/:address/follow
sdk.user.address("...").follow.POST(...); // UserFavoriteResponseDto

// GET /user/:address/favorite/users
sdk.user.address("...").favorite.users(...); // string[]

// GET /user/:address/delegation
sdk.user.address("...").delegation(...); // DelegationDataOutput[]

// GET /user/lending/:address
sdk.user.lending.address("...")(...); // LendingAccountProfile[]

// GET /user/lending/position/:identifier
sdk.user.lending.position.identifier("...")(...); // LendingAccountProfile[]

// GET /user/lending/summary/:identifier
sdk.user.lending.summary.identifier("...")(...); // LendingAccountSummary

// GET /user/lending/image/:nonce
sdk.user.lending.image.nonce("...")(...); // string

// GET /user/:address/inventory-summary
sdk.user.address("...").inventorySummary(...); // InventorySummaryDtoHydrated[]

// GET /user/:address/offers
sdk.user.address("...").offers(...); // NftOfferPaginated

// GET /user/:address/favorite/nfts
sdk.user.address("...").favorite.nfts(...); // NftPaginated

// GET /user/:address/creator/listing
sdk.user.address("...").creator.listing(...); // CreatorDetailsDto

// GET /user/:address/creator/details
sdk.user.address("...").creator.details(...); // CreatorDetailsDto

// GET /user/native-token
sdk.user.nativeToken(...); // string

// GET /user/web2
sdk.user.web2(...); // Web2UserDoc

// POST /user/web2/session-cookie
sdk.user.web2.sessionCookie.POST(...); // SuccessWithMessageDto

// POST /user/web2/wallet
sdk.user.web2.wallet.POST(...); // Web2UserDoc

// POST /user/web2/wallet-switch
sdk.user.web2.walletSwitch.POST(...); // Web2UserDoc

// POST /user/web2/wallet-link
sdk.user.web2.walletLink.POST(...); // Web2UserDoc

// DELETE /user/web2/:index/wallet-link
sdk.user.web2.index("...").walletLink.DELETE(...); // Web2UserDoc

// GET /user/web2/shards
sdk.user.web2.shards(...); // Web2UserShardsDto

// GET /user/:address/staking/available-pools
sdk.user.address("...").staking.availablePools(...); // StakingSummary[]

// GET /user/:address/staking/owned-collections
sdk.user.address("...").staking.ownedCollections(...); // OwnedCollectionsDto

// GET /user/:address/staking/owned-pools
sdk.user.address("...").staking.ownedPools(...); // StakingSummary[]

// GET /user/:address/staking/summary
sdk.user.address("...").staking.summary(...); // UserStakingSummaryDto[]

// GET /user/:address/staking/creator
sdk.user.address("...").staking.creator(...); // StakingCreatorDoc

// GET /user/:address/staking/collection/:collection
sdk.user.address("...").staking.collection.collection("...")(...); // StakingSummary[]

// GET /user/:address/staking/pool/:poolId/nfts
sdk.user.address("...").staking.pool.poolId("...").nfts(...); // StakingUserPoolNfts

// GET /user/:creatorTag/owned-services
sdk.user.creatorTag("...").ownedServices(...); // OwnedServicesDto

// GET /user/search
sdk.user.search(...); // GlobalSearchResourcesPaginated

// GET /user/notifications
sdk.user.notifications(...); // NotificationPaginated

// GET /user/notifications/unread-count
sdk.user.notifications.unreadCount(...); // PushNotificationCountResponse

// DELETE /user/notifications/clear
sdk.user.notifications.clear.DELETE(...); // SuccessDto

// PATCH /user/notifications/read
sdk.user.notifications.read.PATCH(...); // NotificationDoc|SuccessDto

// GET /user/:address/analytics/volume
sdk.user.address("...").analytics.volume(...); // UserAnalyticsDto

// GET /user/stats
sdk.user.stats(...); // UserStatsDto[]

// GET /user/xoxno-drop
sdk.user.xoxnoDrop(...); // AirdropDtoHydrated[]

// GET /user/me/xoxno-drop
sdk.user.me.xoxnoDrop(...); // AirdropDtoHydrated[]

// POST /user/login
sdk.user.login.POST(...); // LoginAccessDto

// POST /user/chat/message
sdk.user.chat.message.POST(...); // ChatMessageDocHydrated

// GET /user/chat/conversation
sdk.user.chat.conversation(...); // UserConversationPaginated

// GET /user/chat/conversation/:conversationId
sdk.user.chat.conversation.conversationId("...")(...); // ChatMessagePaginated

// DELETE /user/chat/conversation/:conversationId
sdk.user.chat.conversation.conversationId("...").DELETE(...); // SuccessDto

// GET /user/chat/conversation-summary
sdk.user.chat.conversationSummary(...); // GlobalConversationSummaryDto

// DELETE /user/chat/conversation/:conversationId/message/:messageId
sdk.user.chat.conversation.conversationId("...").message.messageId("...").DELETE(...); // SuccessDto

// GET /user/chat/block
sdk.user.chat.block(...); // UserBlockPaginated

// POST /user/chat/block/:address
sdk.user.chat.block.address("...").POST(...); // SuccessDto

// POST /user/chat/token
sdk.user.chat.token.POST(...); // WebSocketTokenDto

// GET /user/:address/creator/events
sdk.user.address("...").creator.events(...); // CreatorDetailsDto

// GET /user/me/event
sdk.user.me.event(...); // EventProfile[]

// GET /user/me/events/past
sdk.user.me.events.past(...); // EventProfile[]

// GET /user/me/events/hosted
sdk.user.me.events.hosted(...); // EventProfile[]

// GET /user/me/events/upcoming
sdk.user.me.events.upcoming(...); // EventProfile[]

// GET /user/me/event/badge
sdk.user.me.event.badge(...); // string

// GET /user/me/event/badge/payload
sdk.user.me.event.badge.payload(...); // BageQRData
```
