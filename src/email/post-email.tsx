import React, { createElement, type ComponentProps } from 'react'

import { Body, Container, Img, Section } from '@react-email/components'
import { createTranslator } from 'use-intl'

import { Markdown } from './Markdown'
import type { IHost, Translations, WithUnsubscribeToken } from './utils'
import {
  Center,
  defaultHost,
  FixedLink,
  FixedText,
  GeneralEmail,
  getHost,
  MEDIA,
  renderGenericEmail,
} from './utils'

const translations = {
  namespace: '',
  translations: {
    en: {
      post: {
        meta: 'An update for event {eventName}',
        title: 'Dear {name},',
        description:
          "We're excited to have you join us at the {eventName}! Please click the button below to claim your ticket and secure your spot:",
        action: 'Claim your ticket',
        info: 'For more information and updates, <xoxnolink>visit our website</xoxnolink>. If you have any questions, feel free to reach out to us <emaillink>via email</emaillink>.',
        maps: 'Open in Google Maps',
        footer: '❤️ Thank you for using XOXNO!',
      },
    },
  },
} as const satisfies Translations

type IProps = {
  host?: IHost
  subject: string
  message: string
  style?: {
    background: string
    backgroundColor: string
  }
}

const messages = translations.translations.en

const PostEmail = ({
  host = defaultHost,
  subject,
  message,
  style = {
    background:
      'linear-gradient(var(--color-palettes-background-color, #121212),var(--color-palettes-background-color, #121212))',
    backgroundColor: 'var(--color-palettes-background-color, #121212)',
  },
  unsubscribeToken,
}: IProps & WithUnsubscribeToken) => {
  const t = createTranslator({
    locale: 'en',
    messages,
    namespace: 'post',
  })

  const HOST = getHost(host)

  return (
    <GeneralEmail
      title={subject}
      HOST={HOST}
      unsubscribeToken={unsubscribeToken}
    >
      <Body style={style}>
        <Container className="max-w-[500px] px-5">
          <Section className="min-h-[100px]">
            <Center>
              <Img
                src={`${MEDIA}/hotlink-ok/email_logo.png`}
                width={130}
                height={24}
                alt="XOXNO Logo"
              />
            </Center>
          </Section>
          <Section className="p-5">
            <Markdown>{message.replace(/# /g, '# &nbsp;')}</Markdown>
          </Section>
          <Section className="py-8 text-center">
            <FixedText className="my-0">
              {t.rich('info', {
                xoxnolink: (children) => (
                  <FixedLink href={HOST}>{children}</FixedLink>
                ),
                emaillink: (children) => (
                  <FixedLink href="mailto:contact@xoxno.com">
                    {children}
                  </FixedLink>
                ),
              })}
            </FixedText>
            <FixedText className="mt-5">{t('footer')}</FixedText>
          </Section>
        </Container>
      </Body>
    </GeneralEmail>
  )
}

export const renderPostEmail = async (
  props: ComponentProps<typeof PostEmail>
) => {
  const Email = createElement(PostEmail, props, null)

  return renderGenericEmail(Email)
}
