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

type IAdditionalProperties = INestSchema | IAllOf | IOneOf

type INestPrimitiveSchema =
  | { type: INestType }
  | { type: 'array'; items: INestSchema }
  | {
      type: 'object'
      additionalProperties: IAdditionalProperties
    }
type INestComplexSchema = { $ref: `#/components/schemas/${string}` }

type INestSchema = INestPrimitiveSchema | INestComplexSchema

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

function isComplexSchema(schema: INestSchema): schema is INestComplexSchema {
  return '$ref' in schema
}

function isAllOfSchema(schema: IAdditionalProperties): schema is IAllOf {
  return 'allOf' in schema
}

function isOneOfSchema(schema: IAdditionalProperties): schema is IOneOf {
  return 'oneOf' in schema
}

function parseSchema(curr: INestSchema, url: string, schemas: object): string {
  if (isComplexSchema(curr)) {
    const theType = curr.$ref.split('/').pop()!
    const schemaRaw = schemas[theType as keyof typeof schemas]
    const isEnum = schemaRaw && 'enum' in schemaRaw
    if (isEnum) {
      sdkEnumImports.push(theType)
    } else if (theType !== 'Object') {
      sdkImports.push(theType)
    }
    return theType
  } else {
    if (curr.type === 'object') {
      if (isAllOfSchema(curr.additionalProperties)) {
        const allOf = curr.additionalProperties.allOf
        return `Record<string, ${`${allOf
          .map((item) => {
            return parseSchema(item, url, schemas)
          })
          .join('&')}`}>`
      } else if (isOneOfSchema(curr.additionalProperties)) {
        const oneOf = curr.additionalProperties.oneOf
        return `Record<string, ${`${oneOf
          .map((item) => {
            return parseSchema(item, url, schemas)
          })
          .join('|')}`}>`
      } else {
        return `Record<string, ${parseSchema(curr.additionalProperties, url, schemas)}>`
      }
    }
    if (curr.type === 'array') {
      return `${parseSchema(curr.items, url, schemas)}[]`
    }
    if (isAllOfSchema(curr)) {
      const allOf = curr.allOf
      return `${allOf
        .map((item) => {
          return parseSchema(item, url, schemas)
        })
        .join('&')}`
    } else if (isOneOfSchema(curr)) {
      const oneOf = curr.oneOf
      return `${oneOf
        .map((item) => {
          return parseSchema(item, url, schemas)
        })
        .join('|')}`
    } else {
      return curr.type
    }
  }
}

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
      const schemas = parsed.components.schemas
      const transformedInputs = queryParameters.length
        ? queryParameters.reduce((acc: Record<string, unknown>, curr) => {
            const parsed = parseSchema(curr.schema, transformedKey, schemas)
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
            transformedKey,
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
                    transformedKey,
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
        ...(result[transformedKey] ?? {}),
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

  await writeFile(
    path.join(process.cwd(), './src/md/transformed.txt'),
    transformed
  )

  /* await writeFile(
    path.join(process.cwd(), './src/test/swagger2.ts'),
    `export const endpoints2 = ${JSON.stringify(result)};`
  ) */
}

parseSwagger()
