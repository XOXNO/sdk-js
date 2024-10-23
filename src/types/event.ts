import type { Owner } from './nft'
import type { CreatorProfile } from './user'

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
    placeId?: string
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
    soldCount: number
    nameWithNumber: boolean
    botProtection: boolean
    requireName: boolean
    requireEmail: boolean
    requirePhoneNumber: boolean
    hasSideEvents: boolean
    isPublished: boolean
    hasCustomQuestions: boolean
    showGuestCount: boolean
    acceptCrypto: boolean
  }
  creatorAddress: string
  pk: string
  _ts: number
  seo?: {
    description: string
    tags: string[]
    alternativeTitle?: string
  }
  creatorProfile: CreatorProfile
  guestSummary: {
    count: number
    guests: Owner[]
  }
  eventPermissions?: Pick<IEventRoles, 'role' | 'permissions' | 'endTime'>
  contractAddress: string
  collection: string
  ticketingContractAddress: string
}

export interface ITicketDoc {
  dataType: 'event-ticket-profile'
  eventId: string
  name: string
  description: string
  profile: string
  royalties: number
  badgeColor: string
  characteristics: Record<string, string>
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

export enum EventUserRoles {
  EVENT_MANAGER = 'event-manager',
  CHECK_IN_MANAGER = 'check-in-manager',
  EVENT_READER = 'event-reader',
}

export enum EventUserRolePermission {
  EVENT_READER_VIEW = 'event-reader-view',
  EVENT_MANAGER_EDIT_PAGE = 'event-manager-edit-page',
  EVENT_MANAGER_CREATE_TICKET = 'event-manager-create-ticket',
  EVENT_MANAGER_EDIT_TICKET = 'event-manager-edit-ticket',
  EVENT_MANAGER_DELETE_TICKET = 'event-manager-delete-ticket',
  EVENT_MANAGER_EDIT_GUEST = 'event-manager-edit-guest',
  EVENT_MANAGER_CREATE_STAGE = 'event-manager-create-stage',
  EVENT_MANAGER_EDIT_STAGE = 'event-manager-edit-stage',
}

export interface IEventRoles {
  dataType: 'event-user-role'
  eventId: string
  name: string
  wallet: string
  email: string
  status: 'active' | 'pending'
  role: EventUserRoles[]
  permissions: EventUserRolePermission[]
  endTime: number
  id: string
  profile?: string
  herotag?: string
}

export const eventRoles = Object.values(EventUserRoles)

export const eventPermissions = Object.values(EventUserRolePermission)
