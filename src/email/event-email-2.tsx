import React, { createElement, type ComponentProps } from 'react'

import { Container, Img, Section } from '@react-email/components'
import { createTranslator } from 'use-intl'

import { getMapsLink, getOnlineLocation } from '../utils'
import type { IEvent } from './types'
import type { IHost, Translations, WithUnsubscribeToken } from './utils'
import {
  bodyStyle,
  Center,
  defaultHost,
  FixedButton,
  FixedHeading,
  FixedLink,
  FixedText,
  GeneralEmail,
  getHost,
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
        title: 'Your {eventName} Ticket is Here',
        greeting: 'Dear {name},',
        description:
          "We're excited to have you join us at the {eventName}! You can use the <b>QR Code attached to this email</b> to pass the event check-in.",
        action: 'CLAIM YOUR DIGITAL TICKET HERE',
        hint: 'If you want to get the best experience and a unique collectible as a memory of this event, click below to claim your digital ticket:',
        qr: 'If you have trouble accessing the ticket on the website, use the <b>QR Code attached to this email</b> to pass the check-in.',
        info: 'For more information and updates, <xoxnolink>visit our website</xoxnolink>. If you have any questions, feel free to reach out to us <emaillink>via email</emaillink>.',
        maps: 'Open in Google Maps',
        footer: 'Thank you for using XOXNO!',
        unsubscribe: {
          label: 'No longer want to receive emails?',
          action: 'Unsubscribe',
        },
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
    background: '#121212',
    backgroundColor: '#121212',
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
      <Container
        className="body max-w-[900px] bg-center bg-cover"
        style={{
          ...style,
          backgroundRepeat: 'no-repeat',
          backgroundImage: event.backgroundImage
            ? `url(${event.backgroundImage})`
            : style.background,
        }}
      >
        <div
          dangerouslySetInnerHTML={{
            __html: `<!--[if gte mso 9]>
      <v:background xmlns:v="urn:schemas-microsoft-com:vml" fill="t">
        <v:fill type="frame" src="${event.backgroundImage}" color="#121212"/>
      </v:background>
    <![endif]-->`,
          }}
        />
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
                {t('title', { eventName: event.name })}
              </FixedHeading>
              <FixedText className="mb-0">{t('greeting', { name })}</FixedText>
              <FixedText>
                {t.rich('description', {
                  eventName: event.name,
                  b: (chunks) => <b>{chunks}</b>,
                })}
              </FixedText>
            </Center>
            <Center>
              <FixedLink href={href}>
                <Img
                  src={event.ticketImage}
                  width={200}
                  alt="Picture of ticket"
                />
              </FixedLink>
            </Center>
          </Section>
          <Section width={'95%'}>
            <Center>
              <FixedText>{t('hint')}</FixedText>
              <FixedButton href={href} className="mb-3 block">
                {t('action')}
              </FixedButton>
              <table
                role="presentation"
                cellSpacing="0"
                cellPadding="0"
                border={0}
                style={{
                  background: 'linear-gradient(#121212,#121212)',
                  backgroundColor: '#121212',
                  borderColor: '#E8EC0D',
                }}
                className="mb-[40px] p-3 rounded-xl border border-solid"
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
                      <FixedText
                        style={{
                          ...bodyStyle,
                          color: '#E8EC0D',
                        }}
                        className="my-0 text-start"
                      >
                        {t.rich('qr', { b: (chunks) => <b>{chunks}</b> })}
                      </FixedText>
                    </td>
                  </tr>
                </tbody>
              </table>
            </Center>
          </Section>
          <Section>
            <FixedText style={smallHeadingStyle} className="mb-0">
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
                      <FixedText className="my-0">
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
          <Section className="py-8 mt-8 text-center border-t border-solid border-[#FFF]/[0.1]">
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
          <Section className="px-5 py-6 pb-12 text-center">
            <FixedText className="mb-0">{t('unsubscribe.label')}</FixedText>
            <FixedLink href={`${HOST}/unsubscribe?token=${unsubscribeToken}`}>
              {t('unsubscribe.action')}
            </FixedLink>
          </Section>
        </Container>
      </Container>
    </GeneralEmail>
  )
}

export const renderEventEmail2 = async (
  props: ComponentProps<typeof EventEmail>
) => {
  const Email = createElement(EventEmail, props, null)

  return renderGenericEmail(Email)
}
