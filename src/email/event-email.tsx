import React, { createElement, type ComponentProps } from 'react'

import { Body, Container, Img, Section } from '@react-email/components'
import { createTranslator } from 'use-intl'

import { getMapsLink, getOnlineLocation } from '../utils'
import type { IEvent } from './types'
import type { IHost, Translations, WithUnsubscribeToken } from './utils'
import {
  Center,
  defaultHost,
  FixedButton,
  FixedHeading,
  FixedLink,
  FixedText,
  GeneralEmail,
  getHost,
  headingStyle,
  MEDIA,
  renderGenericEmail,
  smallHeadingStyle,
  ThankYou,
} from './utils'

const translations = {
  namespace: '',
  translations: {
    en: {
      event: {
        meta: 'Your {eventName} Ticket is Here – Claim Now!',
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
  name: string
  event: IEvent
  style?: {
    background: string
    backgroundColor: string
  }
}

const messages = translations.translations.en

const EventEmail = ({
  host = defaultHost,
  event,
  name,
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
    namespace: 'event',
  })

  const HOST = getHost(host)

  const href = `${HOST}/event/${event.eventId}?guest=${event.ticketId}`

  const mapsLink = getMapsLink(event.location)

  return (
    <GeneralEmail
      title={t('meta', { eventName: event.name })}
      HOST={HOST}
      unsubscribeToken={unsubscribeToken}
    >
      <Body
        className="min-h-screen bg-center bg-cover"
        style={{
          ...style,
          backgroundImage: event.backgroundImage
            ? `url(${event.backgroundImage})`
            : style.background,
        }}
      >
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
            <Center>
              <FixedHeading className="my-0">
                {t('title', { name })}
              </FixedHeading>
              <FixedText>
                {t('description', { eventName: event.name })}
              </FixedText>
              <FixedButton href={href} className="mt-2 mb-[40px]">
                {t('action')}
              </FixedButton>
            </Center>
            <Center>
              <Img
                src={event.ticketImage}
                width={320}
                alt="Picture of ticket"
              />
            </Center>
          </Section>
          <Section>
            <FixedText style={headingStyle} className="mb-0">
              {event.time}
            </FixedText>
            <Center>
              <table
                role="presentation"
                cellSpacing="0"
                cellPadding="0"
                border={0}
                style={{ borderCollapse: 'collapse' }}
              >
                <tbody>
                  <tr>
                    <td
                      style={{
                        paddingRight: '16px',
                        verticalAlign: 'middle',
                      }}
                    >
                      <Img
                        src={`${MEDIA}/hotlink-ok/email_pin.png`}
                        width={24}
                        height={24}
                        alt="Location pin"
                      />
                    </td>
                    <td style={{ verticalAlign: 'middle' }}>
                      <FixedText>
                        {event.location.onlineLink
                          ? getOnlineLocation(event.location.onlineLink)
                          : event.location.address}
                      </FixedText>
                    </td>
                  </tr>
                </tbody>
              </table>
              {event.location.address && event.location.placeId && (
                <FixedLink href={mapsLink}>{t('maps')}</FixedLink>
              )}
            </Center>
          </Section>
          <Section className="py-8 text-center">
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
        </Container>
      </Body>
    </GeneralEmail>
  )
}

export const renderEventEmail = async (
  props: ComponentProps<typeof EventEmail>
) => {
  const Email = createElement(EventEmail, props, null)

  return renderGenericEmail(Email)
}
