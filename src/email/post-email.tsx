import React, { createElement, type ComponentProps } from 'react'

import { Body, Container, Img, Section } from '@react-email/components'
import { createTranslator } from 'use-intl'

import { Markdown } from './Markdown'
import type { IHost, Translations, WithUnsubscribeToken } from './utils'
import {
  Center,
  defaultBodyStyle,
  defaultHost,
  FixedLink,
  FixedText,
  GeneralEmail,
  getHost,
  MEDIA,
  renderGenericEmail,
  ThankYou,
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
        footer: 'Thank you for using XOXNO!',
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
  style = defaultBodyStyle,
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
      {({ unsubscribeSection }) => {
        return (
          <Body className="body" style={style}>
            <Container className="px-5">
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
              <Section className="pt-8 pb-3 text-center">
                <FixedText className="my-0">
                  {t.rich('info', {
                    xoxnolink: (children) => (
                      <FixedLink href={HOST} disableFix>
                        {children}
                      </FixedLink>
                    ),
                    emaillink: (children) => (
                      <FixedLink href="mailto:contact@xoxno.com" disableFix>
                        {children}
                      </FixedLink>
                    ),
                  })}
                </FixedText>
                <ThankYou text={t('footer')} />
              </Section>
              {unsubscribeSection}
            </Container>
          </Body>
        )
      }}
    </GeneralEmail>
  )
}

export const renderPostEmail = async (
  props: ComponentProps<typeof PostEmail>
) => {
  const Email = createElement(PostEmail, props, null)

  return renderGenericEmail(Email)
}
