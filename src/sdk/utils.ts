export const coveredMethods = ['PATCH', 'POST', 'DELETE', 'PUT'] as const

const _nestTypes = ['string', 'number', 'boolean'] as const

const _returnTypes = ['application/json', 'multipart/form-data'] as const

const _securityModes = [
  'requiredAny',
  'requiredWeb2',
  'requiredJwt',
  'optionalAny',
] as const

export type ICoveredMethods = (typeof coveredMethods)[number]
export type INestType = (typeof _nestTypes)[number]
export type IReturnTypes = (typeof _returnTypes)[number]
export type ISecurityMode = (typeof _securityModes)[number]
