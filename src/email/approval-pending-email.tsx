import React, { createElement, type ComponentProps } from 'react'

import { Body, Container, Img, Section } from '@react-email/components'
import { createTranslator } from 'use-intl'

import { defaultHost, IEmailConfig } from '../utils'
import { IEvent } from './types'
import type { Translations, WithUnsubscribeToken } from './utils'
import {
  Center,
  defaultBodyStyle,
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
        meta: 'You requested to join {eventName}',
        title: 'You requested to join {eventName}',
        greeting: 'Dear {name},',
        description:
          '<b>You requested to join the {eventName} as a guest!</b> <br></br> The organizer will accept or reject your request, in the meantime you can <explorelink>explore more events on {appName}</explorelink>.',
        info: 'For more information and updates, <xoxnolink>visit our website</xoxnolink>. If you have any questions, feel free to reach out to us <emaillink>via email</emaillink>.',
        footer: 'Thank you for using {appName}!',
      },
    },
  },
} as const satisfies Translations

type IProps = {
  host?: IEmailConfig
  name: string
  event: Pick<IEvent, 'name' | 'backgroundImage'>
  style?: {
    background: string
    backgroundColor: string
  }
}

const messages = translations.translations.en

const ApprovalPendingEmail = ({
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

  const href = `${HOST}/explore/events`

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
                <Section className="p-5 pb-0">
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
                        br: () => <br />,
                        explorelink: (children) => (
                          <FixedLink href={href} disableFix>
                            {children}
                          </FixedLink>
                        ),
                      })}{' '}
                    </FixedText>
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

export const renderApprovalPendingEmail = async (
  props: ComponentProps<typeof ApprovalPendingEmail>
) => {
  const Email = createElement(ApprovalPendingEmail, props, null)

  return renderGenericEmail(Email)
}
