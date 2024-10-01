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
        meta: 'Approval request {eventName} rejected',
        title: 'Approval request for {eventName} rejected',
        greeting: 'Dear {name},',
        description:
          "We're informing you that the organizers <b>rejected your request to join {eventName}</b>. But don't worry, you can <explorelink>explore more events on {appName}</explorelink>.",
        info: 'For more information and updates, <xoxnolink>visit our website</xoxnolink>. If you have any questions, feel free to reach out to us <emaillink>via email</emaillink>.',
        footer: 'Thank you for using {appName}!',
      },
    },
  },
} as const satisfies Translations

type IProps = {
  host?: IEmailConfig
  name: string
  event: Pick<IEvent, 'name' | 'backgroundImage' | 'eventId'>
  style?: {
    background: string
    backgroundColor: string
  }
}

const messages = translations.translations.en

const ApprovalRejectedEmail = ({
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
  const buyHref = `${HOST}/event/${event.eventId}`

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
                    src={`${MEDIA}/hotlink-ok/unsuccess.png`}
                    width="100%"
                    height="140px"
                    className="object-cover"
                    alt="XOXNO Banner"
                  />
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
                        buylink: (children) => (
                          <FixedLink href={buyHref} disableFix>
                            {children}
                          </FixedLink>
                        ),
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

export const renderApprovalRejectedEmail = async (
  props: ComponentProps<typeof ApprovalRejectedEmail>
) => {
  const Email = createElement(ApprovalRejectedEmail, props, null)

  return renderGenericEmail(Email)
}
