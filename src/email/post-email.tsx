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
import { Markdown } from './Markdown';

const translations = {
  namespace: '',
  translations: {
    en: {
      post: {
        meta: 'An update for event {eventName}',
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
  subject: string;
  message: string;
  style?: {
    backgroundColor: string;
  };
};

const messages = translations.translations.en;

const PostEmail = ({
  host = defaultHost,
  subject,
  message,
  style = { backgroundColor: '#121212' },
}: IProps) => {
  const t = createTranslator({
    locale: 'en',
    messages,
    namespace: 'post',
  });

  const HOST = getHost(host);

  return (
    <GeneralEmail title={subject}>
      <Body
        className="min-h-screen bg-center bg-cover"
        style={{
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
            <Markdown>{message.replace(/# /g, '# &nbsp;')}</Markdown>
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

export const renderPostEmail = async (
  props: ComponentProps<typeof PostEmail>
) => {
  const Email = createElement(PostEmail, props, null);

  return renderGenericEmail(Email);
};
