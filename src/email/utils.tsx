import type { ComponentProps, ReactNode } from 'react'
import React, {
  type CSSProperties,
  type PropsWithChildren,
  type ReactElement,
} from 'react'

import {
  Button,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  renderAsync,
  Tailwind,
  Text,
} from '@react-email/components'
import he from 'he'

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

export type WithUnsubscribeToken = { unsubscribeToken: string }

export const GeneralEmail = ({
  title,
  children,
}: PropsWithChildren<
  { title: string; HOST: string } & WithUnsubscribeToken
>) => {
  return (
    <Tailwind>
      <Html
        lang="en"
        className="no-scrollbar"
        style={{ background: '#121212', backgroundColor: '#121212' }}
      >
        <Head>
          <title>{title}</title>
          <meta name="color-scheme" content="light dark" />
          <meta name="supported-color-schemes" content="light dark only" />
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

  u ~ div .gmail-screen { background:#000; mix-blend-mode:screen; /* background:transparent; */ }
  u ~ div .gmail-difference { background:#000; mix-blend-mode:difference; /* background:transparent; */ }
`}
          </style>
        </Head>
        <Preview>{title}</Preview>
        {children}
      </Html>
    </Tailwind>
  )
}

export const headingStyle = {
  color: '#FFF',
  fontFamily: `Heading, ${fallbackFont}`,
  textAlign: 'center',
  fontSize: '28px',
  fontStyle: 'normal',
  fontWeight: '600',
  lineHeight: '36px',
} satisfies CSSProperties

export const smallHeadingStyle = {
  color: '#FFF',
  fontFamily: `Button, ${fallbackFont}`,
  textAlign: 'center',
  fontSize: '19px',
  fontStyle: 'normal',
  fontWeight: '500',
  lineHeight: '26px',
} satisfies CSSProperties

const linkStyle = {
  color: '#AEFB4F',
  fontFamily: `Body, ${fallbackFont}`,
  fontSize: '16px',
  fontStyle: 'normal',
  fontWeight: '500',
  lineHeight: '24px',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

export const bodyStyle = {
  color: '#D0D0D0',
  textAlign: 'center',
  fontFamily: `Body, ${fallbackFont}`,
  fontSize: '16px',
  fontStyle: 'normal',
  fontWeight: '400',
  lineHeight: '24px',
} satisfies CSSProperties

export const hintStyle = {
  color: '#D0D0D0',
  textAlign: 'center',
  fontFamily: `Body, ${fallbackFont}`,
  fontSize: '14px',
  fontStyle: 'normal',
  fontWeight: '300',
  lineHeight: '16px',
} satisfies CSSProperties

export const highlightStyle = {
  color: '#FFF',
  fontFamily: `Body, ${fallbackFont}`,
  fontSize: '16px',
  fontStyle: 'normal',
  fontWeight: '500',
  lineHeight: '24px',
} satisfies CSSProperties

const buttonStyle = {
  fontFamily: `Button, ${fallbackFont}`,
  padding: '12px 20px',
  borderRadius: '8px',
  background: 'linear-gradient(#953fff,#953fff)',
  backgroundColor: '#953fff',
  color: '#FFF',
  fontSize: '14px',
  fontStyle: 'normal',
  fontWeight: '500',
  lineHeight: '16px',
} satisfies CSSProperties

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

export function FixedHeading({
  children,
  ...props
}: ComponentProps<typeof Heading>) {
  return (
    <Heading {...props} style={{ ...headingStyle, ...props.style }}>
      <span className="gmail-screen">
        <span className="gmail-difference">{children}</span>
      </span>
    </Heading>
  )
}

export function FixedText({ children, ...props }: ComponentProps<typeof Text>) {
  return (
    <Text {...props} style={{ ...bodyStyle, ...props.style }}>
      <span className="gmail-screen">
        <span className="gmail-difference">{children}</span>
      </span>
    </Text>
  )
}

export function FixedLink({
  children,
  disableFix,
  ...props
}: ComponentProps<typeof Link> & { disableFix?: boolean }) {
  return (
    <Link {...props} style={{ ...linkStyle, ...props.style }}>
      {disableFix ? (
        children
      ) : (
        <span className="gmail-screen">
          <span className="gmail-difference">{children}</span>
        </span>
      )}
    </Link>
  )
}

export function FixedButton({
  children,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button {...props} style={{ ...buttonStyle, ...props.style }}>
      <span className="gmail-screen">
        <span className="gmail-difference">{children}</span>
      </span>
    </Button>
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

export function ThankYou({
  text,
  isThankYou = true,
}: {
  text: ReactNode
  isThankYou?: boolean
}) {
  if (isThankYou) {
    return (
      <table
        role="presentation"
        cellSpacing="0"
        cellPadding="0"
        border={0}
        style={{ borderCollapse: 'collapse' }}
        className="mt-5"
        align="center"
      >
        <tbody>
          <tr>
            <td
              style={{
                paddingRight: '8px',
                paddingTop: '4px',
                verticalAlign: 'middle',
              }}
            >
              ❤️
            </td>
            <td style={{ verticalAlign: 'middle' }}>
              <FixedText className="my-0">{text}</FixedText>
            </td>
          </tr>
        </tbody>
      </table>
    )
  }

  return <FixedText className="mt-5">{text}</FixedText>
}
