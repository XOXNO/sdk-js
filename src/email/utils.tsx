import React, {
  type CSSProperties,
  type PropsWithChildren,
  type ReactElement,
} from 'react'

import {
  Head,
  Html,
  Link,
  Preview,
  renderAsync,
  Section,
  Tailwind,
} from '@react-email/components'
import he from 'he'
import { createTranslator } from 'use-intl'

export const MEDIA = 'https://media.xoxno.com'

const fallbackFont = 'Verdana'

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
    : ''

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
  )
}

const translations = {
  namespace: '',
  translations: {
    en: {
      unsubscribe: {
        label: 'No longer want to receive emails?',
        action: 'Unsubscribe',
      },
    },
  },
} as const satisfies Translations

const messages = translations.translations.en

export type WithUnsubscribeToken = { unsubscribeToken: string }

export const GeneralEmail = ({
  title,
  children,
  HOST,
  unsubscribeToken,
}: PropsWithChildren<
  { title: string; HOST: string } & WithUnsubscribeToken
>) => {
  const t = createTranslator({
    locale: 'en',
    messages,
    namespace: 'unsubscribe',
  })

  return (
    <Tailwind>
      <Html lang="en" className="no-scrollbar">
        <Head>
          <title>{title}</title>
          <Font
            fontFamily="Heading"
            fallbackFontFamily="Verdana"
            webFont={{
              url: `${MEDIA}/fonts/ClashDisplay-Semibold.woff2`,
              format: 'woff2',
            }}
          />
          <Font
            fontFamily="Button"
            fallbackFontFamily="Verdana"
            webFont={{
              url: `${MEDIA}/fonts/ClashDisplay-Medium.woff2`,
              format: 'woff2',
            }}
          />
          <Font
            fontFamily="Body"
            fallbackFontFamily="Verdana"
            webFont={{
              url: `${MEDIA}/fonts/Satoshi-Light.woff2`,
              format: 'woff2',
            }}
          />
          <style>
            {`
            .no-scrollbar {
              -ms-overflow-style: none;
              scrollbar-width: none;
            }
            .no-scrollbar::-webkit-scrollbar {
              display: none;
            }
          `}
          </style>
          <meta name="color-scheme" content="light only" />
          <meta name="supported-color-schemes" content="light only" />
        </Head>
        <Preview>{title}</Preview>
        {children}
        <Section className="py-6 px-5 pb-12 text-center" style={bodyStyle}>
          {t('label')}{' '}
          <Link
            href={`${HOST}/unsubscribe?token=${unsubscribeToken}`}
            style={linkStyle}
          >
            {t('action')}
          </Link>
        </Section>
      </Html>
    </Tailwind>
  )
}

export function Center({ children }: PropsWithChildren) {
  return (
    <table width="100%" border={0} cellSpacing="0" cellPadding="0">
      <tr>
        <td align="center">{children}</td>
      </tr>
    </table>
  )
}

export const headingStyle = {
  color: 'var(--color-palettes-primary-text-fill, #FFF)',
  fontFamily: `Heading, ${fallbackFont}`,
  textAlign: 'center',
  fontSize: '28px',
  fontStyle: 'normal',
  fontWeight: '600',
  lineHeight: '36px',
} satisfies CSSProperties

export const smallHeadingStyle = {
  color: 'var(--color-palettes-primary-text-fill, #FFF)',
  fontFamily: `Button, ${fallbackFont}`,
  textAlign: 'center',
  fontSize: '19px',
  fontStyle: 'normal',
  fontWeight: '500',
  lineHeight: '26px',
} satisfies CSSProperties

export const linkStyle = {
  color: 'var(--color-palettes-lime-fill, #AEFB4F)',
  fontFamily: `Body, ${fallbackFont}`,
  fontSize: '16px',
  fontStyle: 'normal',
  fontWeight: '500',
  lineHeight: '24px',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

export const bodyStyle = {
  color: 'var(--color-palettes-button-tertiary-text, #D0D0D0)',
  textAlign: 'center',
  fontFamily: `Body, ${fallbackFont}`,
  fontSize: '16px',
  fontStyle: 'normal',
  fontWeight: '400',
  lineHeight: '24px',
} satisfies CSSProperties

export const hintStyle = {
  color: 'var(--color-palettes-button-tertiary-text, #D0D0D0)',
  textAlign: 'center',
  fontFamily: `Body, ${fallbackFont}`,
  fontSize: '14px',
  fontStyle: 'normal',
  fontWeight: '300',
  lineHeight: '16px',
} satisfies CSSProperties

export const highlightStyle = {
  color: 'var(--color-palettes-primary-text-fill, #FFF)',
  fontFamily: `Body, ${fallbackFont}`,
  fontSize: '16px',
  fontStyle: 'normal',
  fontWeight: '500',
  lineHeight: '24px',
} satisfies CSSProperties

export const buttonStyle = {
  fontFamily: `Button, ${fallbackFont}`,
  padding: '12px 20px',
  borderRadius: '8px',
  background: 'var(--color-palettes-button-primary-fill, #AEFB4F)',
  color: 'var(--color-palettes-button-primary-text, #000)',
  fontSize: '14px',
  fontStyle: 'normal',
  fontWeight: '500',
  lineHeight: '16px',
} satisfies CSSProperties

const locales = ['en', 'de'] as const

type ILocale = (typeof locales)[number]
export type Translations<T = object> = {
  namespace: string
  translations: {
    en: T
  } & Partial<{ [key in Exclude<ILocale, 'en'>]: Partial<T> }>
}

export const defaultHost = 'https://xoxno.com'

const hosts = [
  defaultHost,
  'https://next.xoxno.com',
  'https://devnet.xoxno.com',
] as const

export function getHost(propHost: IHost) {
  return hosts.includes(propHost) ? propHost : defaultHost
}

export type IHost = (typeof hosts)[number]

export const apiMappers: Record<IHost, string> = {
  'https://xoxno.com': 'https://api.xoxno.com',
  'https://next.xoxno.com': 'https://api.xoxno.com',
  'https://devnet.xoxno.com': 'https://devnet-api.xoxno.com',
}

export async function renderGenericEmail(Email: ReactElement) {
  const html = await renderAsync(Email, {
    pretty: true,
  })

  const plainText = await renderAsync(Email, {
    plainText: true,
  })

  const subject = he.decode(html.match(/<title[^>]*>([^<]+)<\/title>/)![1])

  return { html, plainText, subject }
}
