import React, { type ComponentProps } from 'react'

import { Img } from '@react-email/components'
import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'

import { bodyStyle, FixedHeading, FixedLink, FixedText } from './utils'

const MarkdownComponents: Partial<Components> = {
  h1: ({ children }) => (
    <FixedHeading className="text-start">{children}</FixedHeading>
  ),
  h2: ({ children }) => (
    <FixedHeading className="text-start">{children}</FixedHeading>
  ),
  h3: ({ children }) => (
    <FixedHeading className="text-start">{children}</FixedHeading>
  ),
  h4: ({ children }) => (
    <FixedHeading className="text-start">{children}</FixedHeading>
  ),
  h5: ({ children }) => (
    <FixedHeading className="text-start">{children}</FixedHeading>
  ),
  h6: ({ children }) => (
    <FixedHeading className="text-start">{children}</FixedHeading>
  ),
  p: ({ children }) => <FixedText className="text-start">{children}</FixedText>,
  ul: ({ children }) => (
    <ul className="text-start list-disc list-inline pl-0" style={bodyStyle}>
      {children}
    </ul>
  ),
  img: (props) => <Img {...props} width="100%" className="rounded-lg" />,
  a: (props) => <FixedLink {...props} />,
}

export function Markdown(props: ComponentProps<typeof ReactMarkdown>) {
  return <ReactMarkdown components={MarkdownComponents} {...props} />
}
