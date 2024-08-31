import React, { createElement, type ComponentProps } from 'react'

import {
  Body,
  Button,
  Container,
  Heading,
  Img,
  Link,
  Section,
  Text,
} from '@react-email/components'
import { createTranslator } from 'use-intl'

import { NftActivityType } from '../types'
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
import type { IHost, Translations, WithUnsubscribeToken } from './utils'
import {
  bodyStyle,
  buttonStyle,
  defaultHost,
  FixedButton,
  FixedHeading,
  FixedLink,
  FixedText,
  GeneralEmail,
  getHost,
  headingStyle,
  highlightStyle,
  hintStyle,
  linkStyle,
  MEDIA,
  renderGenericEmail,
} from './utils'

const translations = {
  namespace: '',
  translations: {
    en: {
      emails: {
        [NftActivityType.AUCTION_BID]: {
          title: 'You have a new bid on {nftName}',
          description:
            'Hi {name}, there is a new bid of <highlight>{amount} {token}</highlight> for your <FixedLink>{nftName}</FixedLink> on XOXNO.',
          action: 'View bids',
          hint: '',
          footer: '❤️ Thank you for using XOXNO!',
        },
        [NftActivityType.AUCTION_OUT_BID]: {
          title: 'You have been outbid on {nftName}',
          description:
            'Hi {name}, your previous bid has been outbid by a new bid of <highlight>{amount} {token}</highlight> for <FixedLink>{nftName}</FixedLink> on XOXNO.',
          action: 'View bids',
          hint: '',
          footer: '❤️ Thank you for using XOXNO!',
        },
        [NftActivityType.OFFER_CREATE]: {
          title: 'You have a new offer on {nftName}',
          description:
            'Hi {name}, you have received a new offer of <highlight>{amount} {token}</highlight> for your <FixedLink>{nftName}</FixedLink> on XOXNO.',
          action: 'View offer',
          hint: '',
          footer: 'Check your recent offers on <FixedLink>XOXNO</FixedLink>',
        },
        [NftActivityType.OFFER_REJECT]: {
          title: 'Your offer on {nftName} was declined',
          description:
            'Hi {name}, we regret to inform you that your offer of <highlight>{amount} {token}</highlight> was declined by <FixedLink>{owner}</FixedLink>.',
          action: 'View offer',
          hint: '',
          footer: 'Check your recent offers on <FixedLink>XOXNO</FixedLink>',
        },
        [NftActivityType.TRADE]: {
          title: 'Congrats, you sold {nftName}!',
          description:
            'Hi {name}, we are pleased to inform you that your item <FixedLink>{nftName}</FixedLink> has been sold for <highlight>{amount} {token}</highlight>.',
          action: 'View item',
          hint: '',
          footer: '❤️ Thank you for using XOXNO!',
        },
        [NftActivityType.OFFER_TRADE]: {
          title: 'Congrats, you bought {nftName}!',
          description:
            'Hi {name}, we are pleased to inform you that your offer for <FixedLink>{nftName}</FixedLink> was accepted for <highlight>{amount} {token}</highlight>.',
          action: 'View item',
          hint: '',
          footer: '❤️ Thank you for using XOXNO!',
        },
        deposit: {
          title: 'Deposit balance updated',
          description:
            'Hi {name}, your deposit balance {amount, select, 0 {decreased to <highlight>{amount} {token}</highlight>. Visit your profile to top it up again} other {was updated to <highlight>{amount} {token}</highlight>}}.',
          action: 'Go to my profile',
          hint: '',
          footer: '❤️ Thank you for using XOXNO!',
        },
        withdrawDeposit: {
          title: 'Deposit balance updated',
          description:
            'Hi {name}, your deposit balance {amount, select, 0 {decreased to <highlight>{amount} {token}</highlight>. Visit your profile to top it up again} other {was updated to <highlight>{amount} {token}</highlight>}}.',
          action: 'Go to my profile',
          hint: '',
          footer: '❤️ Thank you for using XOXNO!',
        },
        verifyEmail: {
          title: 'Verify your email address',
          description:
            'Hi {name}, please enter the following code on XOXNO to verify your email address:',
          action: 'Verification code',
          hint: 'This code is valid for 10 minutes',
          footer: '❤️ Thank you for using XOXNO!',
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
  host?: IHost
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
  ...props
}: IProps & WithUnsubscribeToken) => {
  const isATrade = isTrade(props)
  const isAOfferTrade = isOfferTrade(props)

  const t = createTranslator({
    locale: 'en',
    messages,
    namespace: `emails.${isATrade ? NftActivityType.TRADE : isAOfferTrade ? NftActivityType.OFFER_TRADE : props.activityType}`,
  })

  const HOST = getHost(host)

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
      title={t('title', payload)}
      HOST={HOST}
      unsubscribeToken={unsubscribeToken}
    >
      <Body
        style={{
          background:
            'linear-gradient(var(--color-palettes-background-color, #121212),var(--color-palettes-background-color, #121212))',
          backgroundColor: 'var(--color-palettes-background-color, #121212)',
        }}
      >
        <Container className="max-w-[500px] px-5">
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
            <Section className="pt-8 pb-6 text-center">
              <FixedHeading className="m-0">{t('title', payload)}</FixedHeading>
              <FixedText className="m-0 mt-2.5">
                {t.rich('description', {
                  ...payload,
                  link: (children) => (
                    <FixedLink href={href}>{children}</FixedLink>
                  ),
                  highlight: (children) => (
                    <FixedText style={highlightStyle}>{children}</FixedText>
                  ),
                })}
              </FixedText>
              {isVerifyEmail(props) ? (
                <Section className="mt-6">
                  <FixedText className="mt-0 mb-2.5">{t('action')}</FixedText>
                  <FixedText style={headingStyle} className="my-0">
                    {props.payload.code}
                  </FixedText>
                  <FixedText style={hintStyle} className="mb-0">
                    {t('hint')}
                  </FixedText>
                </Section>
              ) : (
                <FixedButton href={href} className="mt-5">
                  {t('action')}
                </FixedButton>
              )}
            </Section>
          </Section>
          <Section className="py-6 pb-12">
            <FixedText>
              {t.rich('footer', {
                link: (children) => (
                  <FixedLink href={href}>{children}</FixedLink>
                ),
                highlight: (children) => (
                  <FixedText style={highlightStyle}>{children}</FixedText>
                ),
              })}
            </FixedText>
          </Section>
        </Container>
      </Body>
    </GeneralEmail>
  )
}

export const renderEmail = async (props: ComponentProps<typeof XOXNOEmail>) => {
  const Email = createElement(XOXNOEmail, props, null)

  return renderGenericEmail(Email)
}
