import React, { createElement, type ComponentProps } from 'react'

import { Body, Container, Img, Section } from '@react-email/components'
import { createTranslator } from 'use-intl'

import { defaultHost, getMapsLink, IEmailConfig } from '../utils'
import { IEvent } from './types'
import type { Translations, WithUnsubscribeToken } from './utils'
import {
  Center,
  defaultBodyStyle,
  FixedButton,
  FixedHeading,
  FixedLink,
  FixedText,
  GeneralEmail,
  MEDIA,
  MsFix,
  renderGenericEmail,
  ThankYou,
} from './utils'

const translations = {
  namespace: '',
  translations: {
    en: {
      approval: {
        meta: 'Congrats, you were checked in for {eventName}!',
        title: 'You were checked in for {eventName}',
        greeting: 'Dear {name},',
        description:
          "You were checked in to {eventName}, we hope you're enjoying the event! Did you know that you also <b>received a digital memory</b>? Click below to view or trade it:",
        action: 'VIEW YOUR DIGITAL TICKET HERE',
        info: 'For more information and updates, <xoxnolink>visit our website</xoxnolink>. If you have any questions, feel free to reach out to us <emaillink>via email</emaillink>.',
        footer: 'Thank you for using {appName}!',
      },
    },
  },
} as const satisfies Translations

type IProps = {
  host?: IEmailConfig
  name: string
  event: IEvent & { ticketImage: string }
  style?: {
    background: string
    backgroundColor: string
  }
}

const messages = translations.translations.en

const CheckedInEmail = ({
  host = defaultHost,
  event,
  name,
  style = defaultBodyStyle,
  unsubscribeToken,
}: IProps & WithUnsubscribeToken) => {
  const t = createTranslator({
    locale: 'en',
    messages,
    namespace: 'approval',
  })

  const tPayload = { appName: host.appName }

  const HOST = `https://${host.host}`

  const href = `${HOST}/profile`

  const mapsLink = getMapsLink(event.location)

  return (
    <GeneralEmail
      title={t('meta', { eventName: event.name, ...tPayload })}
      HOST={HOST}
      unsubscribeToken={unsubscribeToken}
    >
      {({ unsubscribeSection }) => {
        return (
          <Body className="body" style={style}>
            <Section
              className="max-w-[1200px] mx-auto bg-center bg-cover"
              style={{
                ...style,
                backgroundImage: event.backgroundImage
                  ? `url(${event.backgroundImage})`
                  : style.background,
              }}
            >
              <MsFix backgroundColor={style.backgroundColor} />
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
                  <Center>
                    <FixedHeading className="my-0">
                      {t('title', { eventName: event.name, ...tPayload })}
                    </FixedHeading>
                    <FixedText className="mb-0">
                      {t('greeting', { name, ...tPayload })}
                    </FixedText>
                    <FixedText>
                      {t.rich('description', {
                        ...tPayload,
                        eventName: event.name,
                        b: (chunks) => <b>{chunks}</b>,
                      })}
                    </FixedText>
                  </Center>
                  <Center>
                    <FixedLink href={href} disableFix>
                      <Img
                        src={event.ticketImage}
                        width={200}
                        alt="Picture of ticket"
                      />
                    </FixedLink>
                  </Center>
                  <Center>
                    <FixedButton href={href} className="block mt-5">
                      {t('action', tPayload)}
                    </FixedButton>
                  </Center>
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

export const renderCheckedInEmail = async (
  props: ComponentProps<typeof CheckedInEmail>
) => {
  const Email = createElement(CheckedInEmail, props, null)

  return renderGenericEmail(Email)
}
