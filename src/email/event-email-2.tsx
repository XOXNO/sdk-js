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

import { getMapsLink, getOnlineLocation } from '../utils'
import type { IEvent } from './types'
import type { IHost, Translations, WithUnsubscribeToken } from './utils'
import {
  bodyStyle,
  buttonStyle,
  Center,
  defaultHost,
  GeneralEmail,
  getHost,
  headingStyle,
  linkStyle,
  MEDIA,
  renderGenericEmail,
  smallHeadingStyle,
} from './utils'

const translations = {
  namespace: '',
  translations: {
    en: {
      event: {
        meta: 'Your {eventName} Ticket is Here – Claim Now!',
        title: 'Your {eventName} Ticket is Here',
        description:
          "Dear {name},<br></br>We're excited to have you join us at the {eventName}! Please click the button below to claim your ticket and secure your spot:",
        action: 'CLAIM YOUR DIGITAL TICKET HERE',
        hint: 'If you want to get the best experience and a unique collectible as a memory of this event, click below to claim your digital ticket:',
        qr: 'If you have trouble accessing the ticket on the website, use the <b>QR Code attached to this email</b> to pass the check-in.',
        info: 'For more information and updates, <xoxnolink>visit our website</xoxnolink>. If you have any questions, feel free to reach out to us <emaillink>via email</emaillink>.',
        maps: 'Open in Google Maps',
        footer: '❤️ Thank you for using XOXNO!',
      },
    },
  },
} as const satisfies Translations

type IProps = {
  host?: IHost
  name: string
  event: IEvent
  style?: {
    backgroundColor: string
  }
}

const messages = translations.translations.en

const EventEmail = ({
  host = defaultHost,
  event,
  name,
  style = { backgroundColor: '#121212' },
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
          backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${event.backgroundImage})`,
          backgroundColor: style.backgroundColor,
        }}
      >
        <Container>
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
              <Heading style={headingStyle} className="my-0">
                {t('title', { eventName: event.name })}
              </Heading>
              <Text style={bodyStyle}>
                {t.rich('description', {
                  eventName: event.name,
                  name,
                  br: () => <br />,
                })}
              </Text>
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
            <Center>
              <Text style={bodyStyle}>{t('hint')}</Text>
              <Button href={href} style={buttonStyle} className="mb-3 block">
                {t('action')}
              </Button>
              <table
                role="presentation"
                cellSpacing="0"
                cellPadding="0"
                border={0}
                className="mb-[40px] bg-[#161502] p-3 rounded-xl border border-solid border-[#E8EC0D]"
              >
                <tbody>
                  <tr>
                    <td
                      style={{
                        paddingRight: '16px',
                        paddingTop: '4px',
                        verticalAlign: 'baseline',
                      }}
                    >
                      <Img
                        src={`${MEDIA}/hotlink-ok/email_info.png`}
                        width={24}
                        height={24}
                        alt="Info Icon"
                      />
                    </td>
                    <td style={{ verticalAlign: 'middle' }}>
                      <Text
                        style={bodyStyle}
                        className="text-[#E8EC0D] my-0 text-start"
                      >
                        {t.rich('qr', { b: (chunks) => <b>{chunks}</b> })}
                      </Text>
                    </td>
                  </tr>
                </tbody>
              </table>
            </Center>
          </Section>
          <Section>
            <Text style={smallHeadingStyle} className="mb-0">
              {event.time}
            </Text>
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
                      <Text style={bodyStyle} className="my-0">
                        {event.location.onlineLink
                          ? getOnlineLocation(event.location.onlineLink)
                          : event.location.address}
                      </Text>
                    </td>
                  </tr>
                </tbody>
              </table>
              {event.location.address && event.location.placeId && (
                <Link href={mapsLink} style={linkStyle}>
                  {t('maps')}
                </Link>
              )}
            </Center>
          </Section>
          <Section className="px-5 py-8 mt-8 text-center border-t border-solid border-[#fff]/[0.1]">
            <Text style={bodyStyle} className="my-0">
              {t.rich('info', {
                xoxnolink: (children) => (
                  <Link href={HOST} style={linkStyle}>
                    {children}
                  </Link>
                ),
                emaillink: (children) => (
                  <Link href="mailto:contact@xoxno.com" style={linkStyle}>
                    {children}
                  </Link>
                ),
              })}
            </Text>
            <Text style={bodyStyle} className="mt-5">
              {t('footer')}
            </Text>
          </Section>
        </Container>
      </Body>
    </GeneralEmail>
  )
}

export const renderEventEmail2 = async (
  props: ComponentProps<typeof EventEmail>
) => {
  const Email = createElement(EventEmail, props, null)

  return renderGenericEmail(Email)
}
