import { createElement, type ComponentProps } from 'react';

import {
  Body,
  Button,
  Container,
  Heading,
  Img,
  Link,
  Section,
  Text,
} from '@react-email/components';
import { createTranslator } from 'next-intl';

import React from 'react';
import {
  Center,
  GeneralEmail,
  IHost,
  MEDIA,
  Translations,
  bodyStyle,
  buttonStyle,
  defaultHost,
  getHost,
  headingStyle,
  linkStyle,
  renderGenericEmail,
} from './utils';
import { IEvent } from './types';

const translations = {
  namespace: '',
  translations: {
    en: {
      event: {
        meta: "You're invited to join {eventName}",
        title: 'Dear {name},',
        description:
          "We're excited to have you join us at the {eventName}! Please click the button below to redeem your ticket and secure your spot:",
        action: 'Redeem your ticket',
        info: 'For more information and updates, <xoxnolink>visit our website</xoxnolink>. If you have any questions, feel free to reach out to us <emaillink>via email</emaillink>.',
        maps: 'Open in Google Maps',
        footer: '❤️ Thank you for using XOXNO!',
      },
    },
  },
} as const satisfies Translations;

export type IProps = {
  host?: IHost;
  name: string;
  event: IEvent;
  style?: {
    backgroundColor: string;
  };
};

const messages = translations.translations.en;

const EventEmail = ({
  host = defaultHost,
  event,
  name,
  style = { backgroundColor: '#121212' },
}: IProps) => {
  const t = createTranslator({
    locale: 'en',
    messages,
    namespace: 'event',
  });

  const HOST = getHost(host);

  const href = `${HOST}/tickets/${event.ticketId}`;

  const mapsLink = `https://maps.google.com/?q=${event.location.lat},${event.location.lng}`;

  return (
    <GeneralEmail title={t('meta', { eventName: event.name })}>
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
                {t('title', { name })}
              </Heading>
              <Text style={bodyStyle}>
                {t('description', { eventName: event.name })}
              </Text>
              <Button
                href={href}
                style={buttonStyle}
                className="mt-2 mb-[40px]"
              >
                {t('action')}
              </Button>
            </Center>
            <Center>
              <Img
                src={event.ticketImage}
                width={400}
                alt="Picture of ticket"
              />
            </Center>
          </Section>
          <Section>
            <Text style={headingStyle} className="mb-0">
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
                      <Text style={bodyStyle}>{event.location.value}</Text>
                    </td>
                  </tr>
                </tbody>
              </table>
              <Link href={mapsLink} style={linkStyle}>
                {t('maps')}
              </Link>
            </Center>
          </Section>
          <Section className="px-5 py-8 text-center">
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
  );
};

export const renderEventEmail = async (
  props: ComponentProps<typeof EventEmail>
) => {
  const Email = createElement(EventEmail, props, null);

  return renderGenericEmail(Email);
};
