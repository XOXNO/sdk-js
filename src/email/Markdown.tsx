import { Heading, Img, Link, Text } from '@react-email/components';
import React, { type ComponentProps } from 'react';

import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import { bodyStyle, headingStyle, linkStyle } from './utils';

const MarkdownComponents: Partial<Components> = {
  h1: ({ children }) => (
    <Heading className="text-start" style={headingStyle}>
      {children}
    </Heading>
  ),
  h2: ({ children }) => (
    <Heading className="text-start" style={headingStyle}>
      {children}
    </Heading>
  ),
  h3: ({ children }) => (
    <Heading className="text-start" style={headingStyle}>
      {children}
    </Heading>
  ),
  h4: ({ children }) => (
    <Heading className="text-start" style={headingStyle}>
      {children}
    </Heading>
  ),
  h5: ({ children }) => (
    <Heading className="text-start" style={headingStyle}>
      {children}
    </Heading>
  ),
  h6: ({ children }) => (
    <Heading className="text-start" style={headingStyle}>
      {children}
    </Heading>
  ),
  p: ({ children }) => (
    <Text className="text-start" style={bodyStyle}>
      {children}
    </Text>
  ),
  ul: ({ children }) => (
    <ul className="text-start list-disc list-inline pl-0" style={bodyStyle}>
      {children}
    </ul>
  ),
  img: (props) => <Img {...props} width="100%" className="rounded-lg" />,
  a: (props) => <Link style={linkStyle} {...props} />,
};

export function Markdown(props: ComponentProps<typeof ReactMarkdown>) {
  return <ReactMarkdown components={MarkdownComponents} {...props} />;
}
