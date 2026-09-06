/** Build-time OpenAPI renderer for the Stellar lending read contracts. */
export function stellarSchemaTypes(source: Record<string, any>) {
  // Nest emits these existing domain types as unstructured objects. Reuse
  // their precise public definitions instead of weakening them to unknown.
  const schemas = { ...source }
  const refine = (name: string, property: string, schema: object) => {
    if (source[name]) schemas[name] = {
      ...schemas[name],
      properties: { ...schemas[name].properties, [property]: {
        ...schemas[name].properties[property], ...schema,
      } },
    }
  }
  if (source.AssetOracleConfigDto) schemas.AssetOracleConfigDto = {
    'x-sdk-type': 'StellarDomain.StellarAssetOracle',
  }
  for (const field of ['supplyApyRange', 'borrowApyRange']) {
    refine('StellarAssetListItemDto', field, { 'x-sdk-type': 'StellarDomain.StellarApyRange' })
  }
  refine('StellarAssetListItemDto', 'lpUnderlying', {
    'x-sdk-type': 'StellarDomain.StellarLpUnderlying',
  })
  for (const name of ['StellarMarketIndexByHub', 'StellarDetailedMarketDto']) {
    refine(name, 'chain', { 'x-sdk-type': "import('@xoxno/types/enums').ActivityChain" })
  }
  for (const [field, typeName] of Object.entries({
    kind: 'StellarGovernanceProposalKind',
    status: 'StellarGovernanceProposalStatus',
    target: 'StellarGovernanceProposalTarget',
  })) {
    refine('GovernanceProposalDto', field, { 'x-sdk-type': `StellarDomain.${typeName}` })
  }
  refine('StellarLendingContextDto', 'reserveDetailsByKey', {
    additionalProperties: { $ref: '#/components/schemas/ReserveDto' },
  })
  refine('AccountPositionDto', 'initialPaymentMultiplier', {
    'x-sdk-type': 'StellarDomain.StellarInitialPaymentMultiplier',
  })
  // Older OpenAPI releases describe these token quantities as base units.
  for (const field of ['supplyAmount', 'borrowAmount']) {
    refine('AccountPositionDto', field, {
      description: 'Actual token quantity in RAY (1e27), not token base units: floor(scaledBalanceRay * appliedIndexRay / 1e27).',
    })
  }
  refine('AccountPositionDto', 'positionMode', {
    description: 'Stellar position mode: 0 normal, 1 multiply, 2 long, 3 short.',
  })
  refine('GovernanceProposalDto', 'fields', {
    items: { 'x-sdk-type': 'StellarDomain.StellarGovernanceProposalField' },
  })
  const references = new Set<string>()
  const comment = (description?: string) => description
    ? `/** ${description.replace(/\*\//g, '* /').replace(/\r?\n/g, '\n * ')} */\n`
    : ''

  function type(schema: any, prefix = ''): string {
    if (!schema || typeof schema !== 'object') {
      throw new Error('Missing Stellar OpenAPI schema')
    }
    let result: string
    if (schema['x-sdk-type']) {
      result = schema['x-sdk-type']
    } else if (schema.$ref) {
      const name = schema.$ref.split('/').pop()
      if (!schemas[name]) throw new Error(`Missing Stellar schema: ${name}`)
      references.add(name)
      result = `${prefix}${name}`
    } else if (schema.enum) {
      result = [...new Set(schema.enum.map((v: unknown) => JSON.stringify(v)))].join(' | ')
    } else if (schema.allOf || schema.oneOf || schema.anyOf) {
      const members = schema.allOf ?? schema.oneOf ?? schema.anyOf
      result = members.map((s: unknown) => `(${type(s, prefix)})`)
        .join(schema.allOf ? ' & ' : ' | ')
    } else if (schema.type === 'array') {
      result = `Array<${type(schema.items, prefix)}>`
    } else if (schema.type === 'object') {
      const required = new Set(schema.required ?? [])
      const fields = Object.entries(schema.properties ?? {}).map(([key, value]) =>
        `${comment((value as any).description)}${JSON.stringify(key)}${required.has(key) ? '' : '?'}: ${type(value, prefix)};`
      )
      if (schema.additionalProperties && schema.additionalProperties !== true) {
        fields.push(`[key: string]: ${type(schema.additionalProperties, prefix)};`)
      }
      result = fields.length ? `{\n${fields.join('\n')}\n}` : 'Record<string, unknown>'
    } else if (schema.type === 'integer' || schema.type === 'number') {
      result = 'number'
    } else if (['string', 'boolean', 'null'].includes(schema.type)) {
      result = schema.type
    } else {
      throw new Error(`Unsupported Stellar schema: ${JSON.stringify(schema)}`)
    }
    return schema.nullable ? `(${result}) | null` : result
  }

  return {
    type,
    render() {
      const declarations: string[] = []
      // Rendering a referenced schema discovers its nested schemas too.
      for (const name of references) {
        declarations.push(`${comment(schemas[name].description)}export type ${name} = ${type(schemas[name])}\n`)
      }
      return '/** @module Stellar lending API types\n * Generated from src/sdk/swagger.json; do not edit by hand.\n */\n\n' +
        "import type * as StellarDomain from '@xoxno/types/stellar-lending'\n\n" + declarations.join('\n')
    },
  }
}
