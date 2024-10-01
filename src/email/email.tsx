import React, { createElement, type ComponentProps } from 'react'

import { Body, Container, Img, Section } from '@react-email/components'
import { createTranslator } from 'use-intl'

import { NftActivityType } from '../types'
import { defaultHost, IEmailConfig } from '../utils'
import type {
  IBaseNotification,
  IEmailActivityType,
  IOfferTradeTypes,
  IVerifyEmailTypes,
} from './types'
import {
  bidTypes,
  depositTypes,
  offerTradeTypes,
  offerTypes,
  tradeTypes,
  verifyEmailTypes,
  type IBidTypes,
  type IDepositTypes,
  type IOfferTypes,
  type ITradeTypes,
} from './types'
import type { Translations, WithUnsubscribeToken } from './utils'
import {
  defaultBodyStyle,
  FixedButton,
  FixedHeading,
  FixedLink,
  FixedText,
  GeneralEmail,
  headingStyle,
  highlightStyle,
  hintStyle,
  MEDIA,
  MsFix,
  renderGenericEmail,
  ThankYou,
} from './utils'

const translations = {
  namespace: '',
  translations: {
    en: {
      emails: {
        [NftActivityType.AUCTION_BID]: {
          title: 'You have a new bid on {nftName}',
          description:
            'Hi {name}, there is a new bid of <highlight>{amount} {token}</highlight> for your <link>{nftName}</link> on {appName}.',
          action: 'View bids',
          hint: '',
          footer: 'Thank you for using {appName}!',
          info: 'For more information and updates, <xoxnolink>visit our website</xoxnolink>. If you have any questions, feel free to reach out to us <emaillink>via email</emaillink>.',
        },
        [NftActivityType.AUCTION_OUT_BID]: {
          title: 'You have been outbid on {nftName}',
          description:
            'Hi {name}, your previous bid has been outbid by a new bid of <highlight>{amount} {token}</highlight> for <link>{nftName}</link> on {appName}.',
          action: 'View bids',
          hint: '',
          footer: 'Thank you for using {appName}!',
          info: 'For more information and updates, <xoxnolink>visit our website</xoxnolink>. If you have any questions, feel free to reach out to us <emaillink>via email</emaillink>.',
        },
        [NftActivityType.OFFER_CREATE]: {
          title: 'You have a new offer on {nftName}',
          description:
            'Hi {name}, you have received a new offer of <highlight>{amount} {token}</highlight> for your <link>{nftName}</link> on {appName}.',
          action: 'View offer',
          hint: '',
          footer: 'Thank you for using {appName}!',
          info: 'Check your recent offers on <offerslink>{appName}</offerslink>. If you have any questions, feel free to reach out to us <emaillink>via email</emaillink>.',
        },
        [NftActivityType.OFFER_REJECT]: {
          title: 'Your offer on {nftName} was declined',
          description:
            'Hi {name}, we regret to inform you that your offer of <highlight>{amount} {token}</highlight> was declined by <link>{owner}</link>.',
          action: 'View offer',
          hint: '',
          footer: 'Thank you for using {appName}!',
          info: 'Check your recent offers on <offerslink>{appName}</offerslink>. If you have any questions, feel free to reach out to us <emaillink>via email</emaillink>.',
        },
        [NftActivityType.TRADE]: {
          title: 'Congrats, you sold {nftName}!',
          description:
            'Hi {name}, we are pleased to inform you that your item <link>{nftName}</link> has been sold for <highlight>{amount} {token}</highlight>.',
          action: 'View item',
          hint: '',
          footer: 'Thank you for using {appName}!',
          info: 'For more information and updates, <xoxnolink>visit our website</xoxnolink>. If you have any questions, feel free to reach out to us <emaillink>via email</emaillink>.',
        },
        [NftActivityType.OFFER_TRADE]: {
          title: 'Congrats, you bought {nftName}!',
          description:
            'Hi {name}, we are pleased to inform you that your offer for <link>{nftName}</link> was accepted for <highlight>{amount} {token}</highlight>.',
          action: 'View item',
          hint: '',
          footer: 'Thank you for using {appName}!',
          info: 'For more information and updates, <xoxnolink>visit our website</xoxnolink>. If you have any questions, feel free to reach out to us <emaillink>via email</emaillink>.',
        },
        deposit: {
          title: 'Deposit balance updated',
          description:
            'Hi {name}, your deposit balance {amount, select, 0 {decreased to <highlight>{amount} {token}</highlight>. Visit your profile to top it up again} other {was updated to <highlight>{amount} {token}</highlight>}}.',
          action: 'Go to my profile',
          hint: '',
          footer: 'Thank you for using {appName}!',
          info: 'For more information and updates, <xoxnolink>visit our website</xoxnolink>. If you have any questions, feel free to reach out to us <emaillink>via email</emaillink>.',
        },
        withdrawDeposit: {
          title: 'Deposit balance updated',
          description:
            'Hi {name}, your deposit balance {amount, select, 0 {decreased to <highlight>{amount} {token}</highlight>. Visit your profile to top it up again} other {was updated to <highlight>{amount} {token}</highlight>}}.',
          action: 'Go to my profile',
          hint: '',
          footer: 'Thank you for using {appName}!',
          info: 'For more information and updates, <xoxnolink>visit our website</xoxnolink>. If you have any questions, feel free to reach out to us <emaillink>via email</emaillink>.',
        },
        verifyEmail: {
          title: 'Verify your email address',
          description:
            'Hi {name}, please enter the following code on {appName} to verify your email address:',
          action: 'Verification code',
          hint: 'This code is valid for 10 minutes',
          footer: 'Thank you for using {appName}!',
          info: 'For more information and updates, <xoxnolink>visit our website</xoxnolink>. If you have any questions, feel free to reach out to us <emaillink>via email</emaillink>.',
        },
      },
    },
  },
} as const satisfies Translations<{
  emails: Record<
    Exclude<
      IEmailActivityType,
      Exclude<ITradeTypes, 'trade'> | Exclude<IOfferTradeTypes, 'offerTrade'>
    >,
    {
      title: string
      description: string
      action: string
      hint: string
      footer: string
      info: string
    }
  >
}>

function isOfferTrade(props: IProps) {
  return offerTradeTypes.includes(props.activityType as IOfferTradeTypes)
}

function isTrade(props: IProps) {
  return tradeTypes.includes(props.activityType as ITradeTypes)
}

function isDeposit(props: IProps) {
  return depositTypes.includes(props.activityType as IDepositTypes)
}

function isOffer(props: IProps) {
  return offerTypes.includes(props.activityType as IOfferTypes)
}

function isBid(props: IProps) {
  return bidTypes.includes(props.activityType as IBidTypes)
}

function isVerifyEmail(props: IProps) {
  return verifyEmailTypes.includes(props.activityType as IVerifyEmailTypes)
}

type IProps = {
  host?: IEmailConfig
} & (
  | {
      activityType: Exclude<IEmailActivityType, 'verifyEmail'>
      payload: {
        name: string
        address: string
        nft: Pick<IBaseNotification, 'asset' | 'owner' | 'activity'>
        code?: never
      }
    }
  | {
      activityType: Extract<IEmailActivityType, 'verifyEmail'>
      payload: {
        name: string
        address?: never
        nft?: never
        code: string
      }
    }
)

const messages = translations.translations.en

const XOXNOEmail = ({
  host = defaultHost,
  unsubscribeToken,
  style = defaultBodyStyle,
  ...props
}: IProps &
  WithUnsubscribeToken & {
    style?: {
      background: string
      backgroundColor: string
    }
  }) => {
  const isATrade = isTrade(props)
  const isAOfferTrade = isOfferTrade(props)

  const t = createTranslator({
    locale: 'en',
    messages,
    namespace: `emails.${isATrade ? NftActivityType.TRADE : isAOfferTrade ? NftActivityType.OFFER_TRADE : props.activityType}`,
  })

  const tPayload = { appName: host.appName }

  const HOST = `https://${host.host}`

  const isUnsuccess = (
    [
      NftActivityType.AUCTION_OUT_BID,
      NftActivityType.OFFER_REJECT,
    ] as IEmailActivityType[]
  ).includes(props.activityType)

  const payload = {
    name: props.payload.name,
    ...(props.payload.nft
      ? {
          amount: props.payload.nft.activity.price,
          token: props.payload.nft.activity.paymentToken,
          nftName: props.payload.nft.asset.name,
          address: props.payload.address,
          owner: props.payload.nft.owner,
        }
      : {}),
  }

  const imgSrc = props.payload.nft ? props.payload.nft.asset.url : ''

  const href =
    isATrade || isAOfferTrade || isBid(props)
      ? `${HOST}/nft/${props.payload.nft?.asset.identifier}`
      : isDeposit(props)
        ? `${HOST}/profile/${props.payload.address}/wallet`
        : isOffer(props)
          ? `${HOST}/profile/${props.payload.address}/offers${props.activityType === NftActivityType.OFFER_REJECT ? '/placed' : ''}`
          : HOST

  return (
    <GeneralEmail
      title={t('title', { ...payload, ...tPayload })}
      HOST={HOST}
      unsubscribeToken={unsubscribeToken}
    >
      {({ unsubscribeSection }) => {
        return (
          <Body className="body" style={style}>
            <Section className="max-w-[1200px] mx-auto" style={style}>
              <MsFix backgroundColor={style.backgroundColor} />
              <Container className="px-5">
                <Section className="mb-4">
                  <Img
                    src={`${MEDIA}/hotlink-ok/${isUnsuccess ? 'unsuccess.png' : 'success.png'}`}
                    width="100%"
                    height="140px"
                    className="object-cover"
                    alt="XOXNO Banner"
                  />
                </Section>
                <Section>
                  {imgSrc && (
                    <Img
                      src={imgSrc}
                      width="260px"
                      height="260px"
                      className="rounded-xl mx-auto"
                      alt="NFT Image"
                    />
                  )}
                  <Section className="pt-8 pb-0 text-center">
                    <FixedHeading className="m-0">
                      {t('title', { ...payload, ...tPayload })}
                    </FixedHeading>
                    <FixedText className="m-0 mt-2.5">
                      {t.rich('description', {
                        ...payload,
                        ...tPayload,
                        link: (children) => (
                          <FixedLink href={href} disableFix>
                            {children}
                          </FixedLink>
                        ),
                        highlight: (children) => (
                          <span style={highlightStyle}>{children}</span>
                        ),
                      })}
                    </FixedText>
                    {isVerifyEmail(props) ? (
                      <Section className="mt-6">
                        <FixedText className="mt-0 mb-2.5">
                          {t('action', tPayload)}
                        </FixedText>
                        <FixedText style={headingStyle} className="my-0">
                          {props.payload.code}
                        </FixedText>
                        <FixedText style={hintStyle} className="mb-0">
                          {t('hint', tPayload)}
                        </FixedText>
                      </Section>
                    ) : (
                      <FixedButton href={href} className="mt-5">
                        {t('action', tPayload)}
                      </FixedButton>
                    )}
                  </Section>
                </Section>
                <Section className="pt-8 pb-3 mt-8 text-center border-t border-solid border-[#FFF]/[0.1]">
                  <FixedText className="my-0">
                    {t.rich('info', {
                      ...tPayload,
                      xoxnolink: (children) => (
                        <FixedLink href={HOST} disableFix>
                          {children}
                        </FixedLink>
                      ),
                      emaillink: (children) => (
                        <FixedLink
                          href={`mailto:${host.socials.email}`}
                          disableFix
                        >
                          {children}
                        </FixedLink>
                      ),
                      offerslink: (children) => (
                        <FixedLink href={href} disableFix>
                          {children}
                        </FixedLink>
                      ),
                    })}
                  </FixedText>
                  <ThankYou text={t('footer', tPayload)} />
                </Section>
                {unsubscribeSection}
              </Container>
            </Section>
          </Body>
        )
      }}
    </GeneralEmail>
  )
}

export const renderEmail = async (props: ComponentProps<typeof XOXNOEmail>) => {
  const Email = createElement(XOXNOEmail, props, null)

  return renderGenericEmail(Email)
}
