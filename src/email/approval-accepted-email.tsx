import React, { createElement, type ComponentProps } from 'react'

import { Body, Container, Img, Section } from '@react-email/components'
import { createTranslator } from 'use-intl'

import {
  defaultHost,
  getMapsLink,
  getOnlineLocation,
  IEmailConfig,
} from '../utils'
import { IEvent } from './types'
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
      approval: {
        meta: 'Congrats, you got accepted to join {eventName}!',
        title: 'You got accepted to join {eventName}',
        greeting: 'Dear {name},',
        description:
          "We're excited to let you know that the organizers <b>accepted your request to join {eventName}</b>! Click below link to access your ticket, which you can use to check-in.",
        action: 'OPEN MY TICKET',
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
  event: IEvent
  style?: {
    background: string
    backgroundColor: string
  }
}

const messages = translations.translations.en

const ApprovalAcceptedEmail = ({
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

  const href = `${HOST}/event/${event.eventId}`

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
            <Section className="max-w-[1200px] mx-auto" style={style}>
              <MsFix backgroundColor={style.backgroundColor} />
              <Container className="px-5">
                <Section className="mb-4">
                  <Img
                    src={`${MEDIA}/hotlink-ok/success.png`}
                    width="100%"
                    height="140px"
                    className="object-cover"
                    alt="XOXNO Banner"
                  />
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
                    <FixedButton href={href} className="block">
                      {t('action', tPayload)}
                    </FixedButton>
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

export const renderApprovalAcceptedEmail = async (
  props: ComponentProps<typeof ApprovalAcceptedEmail>
) => {
  const Email = createElement(ApprovalAcceptedEmail, props, null)

  return renderGenericEmail(Email)
}
