import React, { createElement, type ComponentProps } from 'react'

import { Body, Container, Img, Section } from '@react-email/components'
import { createTranslator } from 'use-intl'

import {
  defaultHost,
  getMapsLink,
  getOnlineLocation,
  IEmailConfig,
} from '../utils'
import type { IEvent } from './types'
import type { Translations, WithUnsubscribeToken } from './utils'
import {
  bodyStyle,
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
  smallHeadingStyle,
  ThankYou,
} from './utils'

const translations = {
  namespace: '',
  translations: {
    en: {
      event: {
        meta: "Congrats, you're invited to join {eventName}!",
        title: 'Your {eventName} ticket is Here',
        greeting: 'Dear {name},',
        description:
          "We're excited to have you join us at the {eventName}! You can use the <b>QR Code attached to this email</b> to pass the event check-in.",
        action: 'CLAIM YOUR DIGITAL TICKET HERE',
        hint: 'If you want to get the best experience and a unique collectible as a memory of this event, click below to claim your digital ticket:',
        qr: 'If you have trouble accessing the ticket on the website, use the <b>QR Code attached to this email</b> to pass the check-in.',
        info: 'For more information and updates, <xoxnolink>visit our website</xoxnolink>. If you have any questions, feel free to reach out to us <emaillink>via email</emaillink>.',
        maps: 'Open in Google Maps',
        footer: 'Thank you for using {appName}!',
      },
    },
  },
} as const satisfies Translations

type IProps = {
  host?: IEmailConfig
  name: string
  event: IEvent & { ticketImage: string; ticketId: string }
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
  style = defaultBodyStyle,
  unsubscribeToken,
}: IProps & WithUnsubscribeToken) => {
  const t = createTranslator({
    locale: 'en',
    messages,
    namespace: 'event',
  })

  const tPayload = { appName: host.appName }

  const HOST = `https://${host.host}`

  const href = `${HOST}/event/${event.eventId}?guest=${event.ticketId}`

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
              <MsFix
                backgroundColor={style.backgroundColor}
                backgroundImage={event.backgroundImage}
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
                </Section>
                <Section>
                  <Center>
                    <FixedText>{t('hint', tPayload)}</FixedText>
                    <FixedButton href={href} className="mb-3 block">
                      {t('action', tPayload)}
                    </FixedButton>
                    <table
                      role="presentation"
                      cellSpacing="0"
                      cellPadding="0"
                      border={0}
                      style={{
                        ...defaultBodyStyle,
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
                              {t.rich('qr', {
                                ...tPayload,
                                b: (chunks) => <b>{chunks}</b>,
                              })}
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
                      <FixedLink href={mapsLink}>
                        {t('maps', tPayload)}
                      </FixedLink>
                    )}
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

export const renderEventEmail = async (
  props: ComponentProps<typeof EventEmail>
) => {
  const Email = createElement(EventEmail, props, null)

  return renderGenericEmail(Email)
}
