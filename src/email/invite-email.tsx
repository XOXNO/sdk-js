import React, { createElement, type ComponentProps } from 'react'

import { Body, Container, Img, Section } from '@react-email/components'
import { createTranslator } from 'use-intl'

import { eventRoles, EventUserRoles } from '../types'
import type { IHost, Translations, WithUnsubscribeToken } from './utils'
import {
  Center,
  defaultBodyStyle,
  defaultHost,
  FixedButton,
  FixedHeading,
  FixedLink,
  FixedText,
  GeneralEmail,
  getHost,
  MEDIA,
  MsFix,
  renderGenericEmail,
  ThankYou,
} from './utils'

const translations = {
  namespace: '',
  translations: {
    en: {
      invite: {
        meta: "You're invited to join the {eventName} team - Join Now!",
        title: "You're invited to join the {eventName} team",
        greeting: 'Dear {name},',
        description:
          "You're invited to join the {eventName} team as <b>{roleName}</b>!",
        action: 'CLAIM YOUR TEAM SPOT HERE',
        info: 'For more information and updates, <xoxnolink>visit our website</xoxnolink>. If you have any questions, feel free to reach out to us <emaillink>via email</emaillink>.',
        footer: 'Thank you for using XOXNO!',
        types: {
          'check-in-manager': {
            label: 'Check-in Manager',
            description: 'This will allow you to scan tickets of attendees.',
          },
          'event-manager': {
            label: 'Event Manager',
            description: 'This will allow you to manage the event.',
          },
          'event-reader': {
            label: 'Event Viewer',
            description:
              'This will allow you to view the settings of the event.',
          },
        },
      },
    },
  },
} as const satisfies Translations

type IProps = {
  host?: IHost
  name: string
  event: {
    name: string
    backgroundImage: string
    eventId: string
    inviteId: string
    role: EventUserRoles[]
  }
  style?: {
    background: string
    backgroundColor: string
  }
}

const messages = translations.translations.en

const InviteEmail = ({
  host = defaultHost,
  event,
  name,
  style = defaultBodyStyle,
  unsubscribeToken,
}: IProps & WithUnsubscribeToken) => {
  const t = createTranslator({
    locale: 'en',
    messages,
    namespace: 'invite',
  })

  const HOST = getHost(host)

  const href = `${HOST}/event/${event.eventId}/join?guest=${event.inviteId}`

  const mainRole = event.role.sort((a, b) => {
    return eventRoles.indexOf(a) - eventRoles.indexOf(b)
  })[0]

  return (
    <GeneralEmail
      title={t('meta', { eventName: event.name })}
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
                <Section className="p-5 pb-0">
                  <Center>
                    <FixedHeading className="my-0">
                      {t('title', { eventName: event.name })}
                    </FixedHeading>
                    <FixedText className="mb-0">
                      {t('greeting', { name })}
                    </FixedText>
                    <FixedText>
                      {t.rich('description', {
                        eventName: event.name,
                        roleName: t(`types.${mainRole}.label`),
                        b: (chunks) => <b>{chunks}</b>,
                      })}{' '}
                      {t(`types.${mainRole}.description`)}
                    </FixedText>
                    <FixedButton href={href} className="block">
                      {t('action')}
                    </FixedButton>
                  </Center>
                </Section>
                <Section className="pt-8 pb-3 mt-8 text-center border-t border-solid border-[#FFF]/[0.1]">
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
            </Section>
          </Body>
        )
      }}
    </GeneralEmail>
  )
}

export const renderInviteEmail = async (
  props: ComponentProps<typeof InviteEmail>
) => {
  const Email = createElement(InviteEmail, props, null)

  return renderGenericEmail(Email)
}
