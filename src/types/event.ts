import { CreatorInfo } from './collection'
import { CreatorProfile } from './user'

export interface IEventDoc {
  dataType: 'event-profile'
  descriptionUrl: string
  profile: string
  background?: string
  id: string
  slug: string
  title: string
  startTime: number
  endTime: number
  location: {
    address?: string
    lat?: number
    long?: number
    instructions?: string
    onlineLink?: string
  }
  isVirtualEvent: boolean
  registration: {
    visibility: 'public' | 'private'
    maxLimit: number
    userLimit: number
    requireKYC: boolean
    hasWaitlist: boolean
    refundable: boolean
    nameWithNumber: boolean
    botProtection: boolean
    requireName: boolean
    requireEmail: boolean
    requirePhoneNumber: boolean
    hasSideEvents: boolean
    isPublished: boolean
  }
  creatorAddress: string
  pk: string
  _ts: number
  seo?: {
    description: string
    tags: string[]
    alternativeTitle?: string
  }
  creatorProfile: {
    name: string
    contractAddress: string
    address: string
    profile: string
    banner: string
    description: string
    creatorTag: string
  }
}

export interface ITicketDoc {
  dataType: 'event-ticket-profile'
  eventId: string
  name: string
  description: string
  profile: string
  royalties: number
  badgeColor: string
  characteristics: {}
  maxLimit: number
  userLimit: number
  soldCount: number
  createdAt: number
  id: string
}

export interface ITicketStageDoc {
  dataType: 'event-ticket-stage'
  eventId: string
  ticketId: string
  name: string
  startTime: number
  endTime: number
  maxLimit: number
  userLimit: number
  isEnabled: boolean
  isWhitelist: boolean
  requiredApproval: boolean
  prices: {
    tokenIdentifier: string
    tokenNonce: number
    amount: string
    amountShort: number
    decimals: number
    usdValue: number
  }[]
  soldCount: number
  id: string
}
