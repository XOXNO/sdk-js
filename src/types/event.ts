import type { Owner } from './nft'
import type { CreatorProfile } from './user'

export enum IEventCategory {
  FESTIVAL = 'festival',
  CONFERENCE = 'conference',
  NETWORKING = 'networking',
  MEETUP = 'meetup',
  WEB3 = 'web3',
  ENTERTAINMENT = 'entertainment',
}

export const eventCategories = Object.values(IEventCategory)

enum FestivalCategory {
  MUSIC = 'music',
  ARTS_AND_CULTURE = 'arts-and-culture',
  FOOD_AND_DRINK = 'food-and-drink',
  LIFESTYLE_AND_WELLNESS = 'lifestyle-and-wellness',
  LOCAL_AND_COMMUNITY = 'local-and-community',
}

enum ConferenceCategory {
  TECHNOLOGY_AND_INNOVATION = 'technology-and-innovation',
  BUSINESS_AND_FINANCE = 'business-and-finance',
  HEALTHCARE_AND_SCIENCE = 'healthcare-and-science',
  EDUCATION_AND_LEARNING = 'education-and-learning',
  MARKETING_AND_MEDIA = 'marketing-and-media',
}

enum NetworkingCategory {
  INDUSTRY_SPECIFIC = 'industry-specific',
  CAREER_DEVELOPMENT = 'career-development',
  INVESTOR_AND_STARTUPS = 'investor-and-startups',
  SOCIAL_IMPACT = 'social-impact',
  PERSONAL_DEVELOPMENT = 'personal-development',
}

enum MeetupCategory {
  HOBBIES_AND_INTERESTS = 'hobbies-and-interests',
  PROFESSIONAL_GROUPS = 'professional-groups',
  SOCIAL_GATHERING = 'social-gathering',
  EDUCATION_AND_SKILLS = 'education-and-skills',
  FAMILY_AND_KIDS = 'family-and-kids',
}

enum Web3Category {
  BLOCKCHAIN_AND_CRYPTOCURRENCY = 'blockchain-and-cryptocurrency',
  METAVERSE_AND_VR = 'metaverse-and-vr',
  DEFI_AND_FINANCE = 'defi-and-finance',
  DAO_AND_GOVERNANCE = 'dao-and-governance',
  WEB3_STARTUPS = 'web3-startups',
}

enum EntertainmentCategory {
  LIVE_MUSIC = 'live-music',
  COMEDY_SHOWS = 'comedy-shows',
  THEATRE_AND_PERFORMANCE = 'theatre-and-performance',
  MOVIES = 'movies',
  NIGHTLIFE_AND_CLUBBING = 'nightlife-and-clubbing',
}

export const eventSubCategories = {
  festival: Object.values(FestivalCategory),
  conference: Object.values(ConferenceCategory),
  networking: Object.values(NetworkingCategory),
  meetup: Object.values(MeetupCategory),
  web3: Object.values(Web3Category),
  entertainment: Object.values(EntertainmentCategory),
} as const satisfies Record<IEventCategory, string[]>

export type IEventSubCategory =
  (typeof eventSubCategories)[keyof typeof eventSubCategories][number]

export async function getEventCategories() {
  return eventCategories
}

export async function getEventSubCategories(category: IEventCategory) {
  return eventSubCategories[category]
}

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
  startsFrom: {
    price: 0
    currency: string
  }
  eventPermissions?: Pick<IEventRoles, 'role' | 'permissions' | 'endTime'>
  contractAddress: string
  collection: string
  category: IEventCategory
  subCategory?: IEventSubCategory
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
