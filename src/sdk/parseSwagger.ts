import { writeFile } from 'fs/promises'
import path from 'path'

import { parse } from 'yaml'

import {
  coveredMethods,
  type ICoveredMethods,
  type INestType,
  type IReturnTypes,
  type ISecurityMode,
} from './utils'

function deepLookup<T = any>(root: any, dotted: string): T | undefined {
  return dotted.split('.').reduce<any>((node, key) => node?.[key], root)
}

type IEndpoint = {
  input: object
  output: object
  body?: object
}

type IRawSdk = Record<string, IEndpoint & Record<ICoveredMethods, IEndpoint>>

type IAllOf = { allOf: INestSchema[] }

type IOneOf = { oneOf: INestSchema[] }

type INestObjectSchema = {
  type: 'object'
  additionalProperties?: IAdditionalProperties
  properties?: Record<string, INestSchema>
  required?: string[]
}

type INestPrimitiveSchema =
  | { type: Exclude<INestType, 'array' | 'object'> }
  | { type: 'array'; items: INestSchema }
  | INestObjectSchema
type INestComplexSchema = { $ref: `#/components/schemas/${string}` }

type INestSchema = INestPrimitiveSchema | INestComplexSchema | IAllOf | IOneOf

type IAdditionalProperties = INestSchema | boolean

type INestNested = Record<
  IReturnTypes,
  {
    schema: INestSchema
  }
>

const sdkImports: string[] = ['PublicOnly']
const sdkEnumImports: string[] = ['ActivityChain']

type FieldMeta = { type: string; required: boolean }

function metaToTypeShape(meta: Record<string, FieldMeta>): string {
  const fields = Object.entries(meta)
    .map(([name, { type, required }]) => {
      return `${name}${required ? '' : '?'}: ${type}`
    })
    .join(', ')

  const replaced = fields.replace(/^:/, '')

  if (replaced.length < fields.length) {
    return replaced
  }

  return `{${fields}}${
    Object.values(meta).every((m) => !m.required) ? '?' : ''
  }`.replace(/\?$/, '')
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isComplexSchema(schema: unknown): schema is INestComplexSchema {
  return isObjectRecord(schema) && '$ref' in schema
}

function isAllOfSchema(schema: unknown): schema is IAllOf {
  return isObjectRecord(schema) && Array.isArray((schema as IAllOf).allOf)
}

function isOneOfSchema(schema: unknown): schema is IOneOf {
  return isObjectRecord(schema) && Array.isArray((schema as IOneOf).oneOf)
}

function parseSchema(curr: unknown, schemas: Record<string, unknown>): string {
  if (!isObjectRecord(curr)) {
    return 'unknown'
  }

  if (isComplexSchema(curr)) {
    const theType = curr.$ref.split('/').pop()!
    const schemaRaw = schemas[theType as keyof typeof schemas]
    const isEnum = isObjectRecord(schemaRaw) && 'enum' in schemaRaw
    if (isEnum) {
      sdkEnumImports.push(theType)
    } else if (theType !== 'Object') {
      sdkImports.push(theType)
    }
    return theType
  }

  if (isAllOfSchema(curr)) {
    return curr.allOf
      .map((item) => {
        return parseSchema(item, schemas)
      })
      .join('&')
  }

  if (isOneOfSchema(curr)) {
    return curr.oneOf
      .map((item) => {
        return parseSchema(item, schemas)
      })
      .join('|')
  }

  if (!('type' in curr) || typeof curr.type !== 'string') {
    return 'unknown'
  }

  if (curr.type === 'object') {
    const requiredFields = new Set<string>(
      Array.isArray(curr.required)
        ? curr.required.filter((item): item is string => typeof item === 'string')
        : []
    )
    const properties = isObjectRecord(curr.properties)
      ? (curr.properties as Record<string, unknown>)
      : undefined
    const additionalProperties =
      curr.additionalProperties as IAdditionalProperties | undefined

    if (properties && Object.keys(properties).length) {
      const fields = Object.entries(properties)
        .map(([key, value]) => {
          return `${key}${requiredFields.has(key) ? '' : '?'}: ${parseSchema(
            value,
            schemas
          )}`
        })
        .join('; ')
      return `{ ${fields} }`
    }

    if (additionalProperties === undefined || additionalProperties) {
      if (additionalProperties === true || additionalProperties === undefined) {
        return 'Record<string, unknown>'
      }

      if (isAllOfSchema(additionalProperties)) {
        return `Record<string, ${additionalProperties.allOf
          .map((item) => {
            return parseSchema(item, schemas)
          })
          .join(' & ')}>`
      }

      if (isOneOfSchema(additionalProperties)) {
        return `Record<string, ${additionalProperties.oneOf
          .map((item) => {
            return parseSchema(item, schemas)
          })
          .join(' | ')}>`
      }

      return `Record<string, ${parseSchema(additionalProperties, schemas)}>`
    }

    return 'Record<string, never>'
  }

  if (curr.type === 'array') {
    return `${parseSchema(curr.items, schemas)}[]`
  }

  return curr.type
}

const alreadyChecked = new Set<string>([])
const duplicates: string[] = []

async function parseSwagger() {
  const yml = await fetch('https://api.xoxno.com/swagger.yaml').then((res) => {
    return res.text()
  })

  const result: IRawSdk = {}

  const parsed = parse(yml)

  await writeFile(
    path.join(process.cwd(), './src/sdk/swagger.json'),
    JSON.stringify(parsed)
  )

  for (const [key, value] of Object.entries(parsed.paths)) {
    const typedValue = value as Record<
      Lowercase<ICoveredMethods>,
      {
        parameters: [
          {
            name: string
            required: boolean
            in: 'path' | 'query'
            schema: INestSchema
          },
        ]
        requestBody: {
          required: boolean
          content: INestNested
        }
        responses: {
          number: {
            content: INestNested
          }
        }
        security: [Record<ISecurityMode | 'bearer', string[]>]
      }
    >
    for (const [method, endpoint] of Object.entries(typedValue)) {
      const queryParameters = endpoint.parameters.filter((item) => {
        return item.in === 'query'
      })
      const transformedKey = key.replace(/{([^}]+)}/g, ':$1')
      const toCheckRaw = `${method}-${transformedKey}`
      const toCheck = toCheckRaw.replace(/:([^/]+)/g, 'PLACEHOLDER')
      if (alreadyChecked.has(toCheck)) {
        duplicates.push(toCheckRaw)
      } else {
        alreadyChecked.add(toCheck)
      }
      const schemas = parsed.components.schemas as Record<string, unknown>
      const transformedInputs = queryParameters.length
        ? queryParameters.reduce((acc: Record<string, unknown>, curr) => {
            const parsed = parseSchema(curr.schema, schemas)
            acc[curr.name] = {
              type:
                curr.name === 'chain'
                  ? 'ActivityChain[]'
                  : curr.name === 'filter'
                    ? `PublicOnly<${parsed}>`
                    : parsed,
              required: curr.required,
            }
            return acc
          }, {})
        : {}

      const security = endpoint.security?.filter((item) => !item.bearer) ?? {}

      const securityMode = Object.keys(security[0] ?? {})[0]

      if (!Object.values(endpoint.responses)[0].content) {
        console.log('missing api response', transformedKey)
        continue
      }

      const transformedOutputs = {
        '': {
          required: true,
          type: parseSchema(
            Object.values(endpoint.responses)[0].content['application/json']
              .schema,
            schemas
          ),
        },
      }

      const transformedBody = endpoint.requestBody
        ? {
            '': {
              type: endpoint.requestBody.content['application/json']
                ? parseSchema(
                    endpoint.requestBody.content['application/json'].schema,
                    schemas
                  )
                : 'FormData',
              required: endpoint.requestBody.required,
            },
          }
        : {}

      const io = {
        input: transformedInputs,
        output: transformedOutputs,
        body: transformedBody,
        securityMode,
      }

      result[transformedKey] = {
        ...result[transformedKey],
        ...(method === 'get'
          ? {
              input: io.input,
              output: io.output,
              securityMode: io.securityMode,
            }
          : {
              input: result[transformedKey]?.['input'] ?? {},
              output: result[transformedKey]?.['output'] ?? {},
              [method.toUpperCase()]: io,
            }),
      }
    }
  }

  function injectSentinels(obj: any, route = ''): any {
    if (typeof obj !== 'object' || obj === null) return obj

    if ('input' in obj || 'output' in obj || 'body' in obj) {
      const toCheck = deepLookup(result, route) ?? {}

      const { input: inType, output: outType, body: bodyType } = toCheck

      const transformed = {
        ...obj,
        ...(inType && {
          input: metaToTypeShape(inType as Record<string, FieldMeta>),
        }),
        ...(outType && {
          output: metaToTypeShape(outType as Record<string, FieldMeta>),
        }),
        ...(bodyType && {
          body: metaToTypeShape(bodyType as Record<string, FieldMeta>),
        }),
      }

      for (const verb of coveredMethods) {
        if (verb in transformed) {
          transformed[verb] = injectSentinels(
            transformed[verb],
            `${route}.${verb}`
          )
        }
      }

      return transformed
    }

    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [
        k,
        injectSentinels(v, `${route}${k}`),
      ])
    )
  }

  function stringifyWithCasts(obj: any): string {
    const pretty = JSON.stringify(obj, null, 2)

    const re = /(["'](?:input|output|body)["']\s*:\s*)(['"])([\s\S]*?)\2/g

    return pretty
      .replace(re, (_, prefix: string, _q: string, body: string) => {
        const trimmed = body.trim()
        const castTarget = trimmed.length ? trimmed : '{}'
        return `${prefix}{} as ${castTarget}`
      })
      .replace(/\{\} as \{\}/g, '{}')
  }

  const transformed = stringifyWithCasts(injectSentinels(result))

  await writeFile(
    path.join(process.cwd(), './src/sdk/swagger.ts'),
    [
      `import type { ${Array.from(new Set(sdkImports)).join(',')} } from '@xoxno/types';`,
      `import type { ${Array.from(new Set(sdkEnumImports)).join(',')} } from '@xoxno/types/enums';`,
      `export const endpoints = ${transformed} as const;`,
    ].join('\n')
  )

  await writeFile(path.join(process.cwd(), './md/transformed.txt'), transformed)

  if (duplicates.length) {
    console.log(duplicates)
  }

  /* await writeFile(
    path.join(process.cwd(), './src/test/swagger2.ts'),
    `export const endpoints2 = ${JSON.stringify(result)};`
  ) */
}

parseSwagger()
