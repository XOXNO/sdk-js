import type { CSSProperties, ComponentProps } from 'react';

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
  renderAsync,
} from '@react-email/components';
import { createTranslator } from 'next-intl';

const locales = ['en', 'de'] as const;

type ILocale = (typeof locales)[number];
type Translations<T = object> = {
  namespace: string;
  translations: {
    en: T;
  } & Partial<{ [key in Exclude<ILocale, 'en'>]: Partial<T> }>;
};

import {
  IBaseNotification,
  IEmailActivityType,
  bidTypes,
  depositTypes,
  offerTypes,
  tradeTypes,
  type IBidTypes,
  type IDepositTypes,
  type IOfferTypes,
  type ITradeTypes,
} from './types';

import { NftActivityType } from '../types';
import React from 'react';

const translations = {
  namespace: '',
  translations: {
    en: {
      emails: {
        [NftActivityType.AUCTION_BID]: {
          title: 'You have a new bid on your item',
          description:
            'Hi {name}, there is a new bid of <highlight>{amount} {token}</highlight> for your <link>{nftName}</link> on XOXNO.',
          action: 'View bids',
          footer: '❤️ Thank you for using XOXNO!',
        },
        [NftActivityType.AUCTION_OUT_BID]: {
          title: 'You have been outbid',
          description:
            'Hi {name}, your previous bid has been outbid by a new bid of <highlight>{amount} {token}</highlight> for <link>{nftName}</link> on XOXNO.',
          action: 'View bids',
          footer: '❤️ Thank you for using XOXNO!',
        },
        [NftActivityType.OFFER_CREATE]: {
          title: 'You have an offer for your item',
          description:
            'Hi {name}, you have received a new offer of <highlight>{amount} {token}</highlight> for your <link>{nftName}</link> on XOXNO.',
          action: 'View offer',
          footer: 'Check your recent offers on <link>XOXNO</link>',
        },
        [NftActivityType.OFFER_REJECT]: {
          title: 'Your offer was declined',
          description:
            'Hi {name}, we regret to inform you that your offer of <highlight>{amount} {token}</highlight> was declined by <link>{owner}</link>.',
          action: 'View offer',
          footer: 'Check your recent offers on <link>XOXNO</link>',
        },
        [NftActivityType.TRADE]: {
          title: 'Your item is sold',
          description:
            'Hi {name}, we are pleased to inform you that your item <link>{nftName}</link> has been sold for <highlight>{amount} {token}</highlight>.',
          action: 'View item',
          footer: '❤️ Thank you for using XOXNO!',
        },
        [NftActivityType.BULK_TRADE]: {
          title: 'Your item is sold',
          description:
            'Hi {name}, we are pleased to inform you that your item <link>{nftName}</link> has been sold for <highlight>{amount} {token}</highlight>.',
          action: 'View item',
          footer: '❤️ Thank you for using XOXNO!',
        },
        [NftActivityType.OTHER_TRADE]: {
          title: 'Your item is sold',
          description:
            'Hi {name}, we are pleased to inform you that your item <link>{nftName}</link> has been sold for <highlight>{amount} {token}</highlight>.',
          action: 'View item',
          footer: '❤️ Thank you for using XOXNO!',
        },
        [NftActivityType.OFFER_TRADE]: {
          title: 'Your item is sold',
          description:
            'Hi {name}, we are pleased to inform you that your item <link>{nftName}</link> has been sold for <highlight>{amount} {token}</highlight>.',
          action: 'View item',
          footer: '❤️ Thank you for using XOXNO!',
        },
        [NftActivityType.GLOBAL_OFFER_TRADE]: {
          title: 'Your item is sold',
          description:
            'Hi {name}, we are pleased to inform you that your item <link>{nftName}</link> has been sold for <highlight>{amount} {token}</highlight>.',
          action: 'View item',
          footer: '❤️ Thank you for using XOXNO!',
        },
        deposit: {
          title: 'Deposit successful',
          description:
            'Hi {name}, your deposit of <highlight>{amount} {token}</highlight> has been successful.',
          action: 'Go to my profile',
          footer: '❤️ Thank you for using XOXNO!',
        },
        withdrawDeposit: {
          title: 'Withdraw successful',
          description:
            'Hi {name}, your withdrawal of <highlight>{amount} {token}</highlight> has been successful.',
          action: 'Go to my profile',
          footer: '❤️ Thank you for using XOXNO!',
        },
      },
    },
  },
} as const satisfies Translations<{
  emails: Record<
    IEmailActivityType,
    { title: string; description: string; action: string; footer: string }
  >;
}>;

function isTrade(props: IProps): props is ITradeProps {
  return tradeTypes.includes(props.activityType as ITradeTypes);
}

function isDeposit(props: IProps): props is IDepositProps {
  return depositTypes.includes(props.activityType as IDepositTypes);
}

function isOffer(props: IProps): props is IOfferProps {
  return offerTypes.includes(props.activityType as IOfferTypes);
}

function isBid(props: IProps): props is IBidProps {
  return bidTypes.includes(props.activityType as IBidTypes);
}

export type ITradeProps = {
  activityType: Extract<IEmailActivityType, ITradeTypes>;
  payload: {
    name: string;
    nft: Pick<IBaseNotification, 'asset' | 'owner' | 'activity'>;
    address: string;
  };
};

export type IDepositProps = {
  activityType: Extract<IEmailActivityType, IDepositTypes>;
  payload: {
    name: string;
    nft: Pick<IBaseNotification, 'asset' | 'owner' | 'activity'>;
    address: string;
  };
};

export type IBidProps = {
  activityType: Extract<IEmailActivityType, IBidTypes>;
  payload: {
    name: string;
    nft: Pick<IBaseNotification, 'asset' | 'owner' | 'activity'>;
    address: string;
  };
};

export type IOfferProps = {
  activityType: Extract<IEmailActivityType, IOfferTypes>;
  payload: {
    name: string;
    nft: Pick<IBaseNotification, 'asset' | 'owner' | 'activity'>;
    address: string;
  };
};

export type IProps = ITradeProps | IDepositProps | IOfferProps | IBidProps;

const messages = translations.translations.en;

const HOST = 'https://next.xoxno.com';

const fallbackFont = 'Verdana';

const Font = ({
  webFont,
  fontStyle = 'normal',
  fontFamily,
  fontWeight = 400,
  fallbackFontFamily,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}: any) => {
  const src = webFont
    ? `src: url(${webFont.url}) format(${webFont.format});`
    : '';

  return (
    <style>
      {`
          @font-face {
              font-style: ${fontStyle};
              font-family: ${fontFamily};
              font-weight: ${fontWeight};
              mso-font-alt: ${Array.isArray(fallbackFontFamily) ? fallbackFontFamily[0] : fallbackFontFamily};
              ${src}
          }
          `}
    </style>
  );
};

const generateXOXNOEmail = (props: IProps) => {
  const t = createTranslator({
    locale: 'en',
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    messages,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    namespace: `emails.${props.activityType}`,
  });

  const isUnsuccess = (
    [
      NftActivityType.AUCTION_OUT_BID,
      NftActivityType.OFFER_REJECT,
      'withdrawDeposit',
    ] as IEmailActivityType[]
  ).includes(props.activityType);

  const imgSrc = props.payload.nft.asset.url;

  const payload = {
    name: props.payload.name,
    amount: props.payload.nft.activity.price,
    token: props.payload.nft.activity.paymentToken,
    nftName: props.payload.nft.asset.name,
    address: props.payload.address,
    owner: props.payload.nft.owner,
  };

  const href =
    isTrade(props) || isBid(props)
      ? `${HOST}/nft/${props.payload.nft.asset.identifier}`
      : isDeposit(props)
        ? `${HOST}/profile/${props.payload.address}/wallet`
        : isOffer(props)
          ? `${HOST}/profile/${props.payload.address}/offers${props.activityType === NftActivityType.OFFER_REJECT ? '/placed' : ''}`
          : HOST;

  return (
    <Tailwind>
      <Html lang="en">
        <Head>
          <title>{t('title')}</title>
          <Font
            fontFamily="Heading"
            fallbackFontFamily="Verdana"
            webFont={{
              url: `${HOST}/fonts/ClashDisplay-Semibold.woff2`,
              format: 'woff2',
            }}
          />
          <Font
            fontFamily="Button"
            fallbackFontFamily="Verdana"
            webFont={{
              url: `${HOST}/fonts/ClashDisplay-Medium.woff2`,
              format: 'woff2',
            }}
          />
          <Font
            fontFamily="Body"
            fallbackFontFamily="Verdana"
            webFont={{
              url: `${HOST}/fonts/Satoshi-Light.woff2`,
              format: 'woff2',
            }}
          />
        </Head>
        <Preview>{t('title')}</Preview>
        <Body className="bg-[#121212]">
          <Container className="max-w-[500px]">
            <Section className="mb-4">
              <Img
                src={`${HOST}/emails/${isUnsuccess ? 'unsuccess.png' : 'success.png'}`}
                width="100%"
                height="140px"
                className="object-cover"
              />
            </Section>
            <Section>
              {imgSrc && (
                <Img
                  src={imgSrc}
                  width="260px"
                  height="260px"
                  className="rounded-xl mx-auto"
                />
              )}
              <Section className="pt-8 pb-6 px-5 text-center">
                <Heading style={headingStyle} className="m-0">
                  {t('title')}
                </Heading>
                <Text style={bodyStyle} className="m-0 mt-2.5">
                  {t.rich('description', {
                    ...payload,
                    link: (children) => (
                      <Link href={href} style={linkStyle}>
                        {children}
                      </Link>
                    ),
                    highlight: (children) => (
                      <span style={highlightStyle}>{children}</span>
                    ),
                  })}
                </Text>
                <Button href={href} style={buttonStyle} className="mt-5">
                  {t('action')}
                </Button>
              </Section>
            </Section>
            <Section className="py-6 px-5 text-center" style={bodyStyle}>
              {t.rich('footer', {
                link: (children) => (
                  <Link href={href} style={linkStyle}>
                    {children}
                  </Link>
                ),
                highlight: (children) => (
                  <span style={highlightStyle}>{children}</span>
                ),
              })}
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
};

const headingStyle = {
  color: 'var(--color-palettes-primary-text-fill, #FFF)',
  fontFamily: `Heading, ${fallbackFont}`,
  textAlign: 'center',
  fontSize: '28px',
  fontStyle: 'normal',
  fontWeight: 600,
  lineHeight: '36px',
} satisfies CSSProperties;

const linkStyle = {
  color: 'var(--color-palettes-lime-fill, #AEFB4F)',
  fontFamily: `Body, ${fallbackFont}`,
  fontSize: '16px',
  fontStyle: 'normal',
  fontWeight: '500',
  lineHeight: '24px',
  whiteSpace: 'nowrap',
} satisfies CSSProperties;

const bodyStyle = {
  color: 'var(--color-palettes-button-tertiary-text, #D0D0D0)',
  textAlign: 'center',
  fontFamily: `Body, ${fallbackFont}`,
  fontSize: '16px',
  fontStyle: 'normal',
  fontWeight: '400',
  lineHeight: '24px',
} satisfies CSSProperties;

const highlightStyle = {
  color: 'var(--color-palettes-primary-text-fill, #FFF)',
  fontFamily: `Body, ${fallbackFont}`,
  fontSize: '16px',
  fontStyle: 'normal',
  fontWeight: '500',
  lineHeight: '24px',
} satisfies CSSProperties;

const buttonStyle = {
  fontFamily: `Button, ${fallbackFont}`,
  padding: '12px 20px',
  borderRadius: '8px',
  background: 'var(--color-palettes-button-primary-fill, #AEFB4F)',
  color: 'var(--color-palettes-button-primary-text, #000)',
  fontSize: '14px',
  fontStyle: 'normal',
  fontWeight: '500',
  lineHeight: '16px',
} satisfies CSSProperties;

export const renderEmail = async (
  props: ComponentProps<typeof generateXOXNOEmail>
): Promise<{
  html: string;
  plainText: string;
  subject: string | undefined;
}> => {
  const Email = generateXOXNOEmail(props);

  const html = await renderAsync(Email, {
    pretty: true,
  });

  const plainText = await renderAsync(Email, {
    plainText: true,
  });

  const subject = html.match(/<title[^>]*>([^<]+)<\/title>/)?.[1];

  return { html, plainText, subject };
};
