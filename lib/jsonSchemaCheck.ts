/**
 * Minimal validator for the JSON Schema subset Anthropic structured outputs
 * accepts. Two jobs:
 *
 * 1. `findSchemaIncompatibilities` catches schemas the API would reject or
 *    silently rewrite (missing `additionalProperties: false`, constraints that
 *    get moved into `description`).
 * 2. `validateAgainstSchema` checks a model response really matches the schema,
 *    which is what makes the golden-set evals a verifier rather than a vibe.
 *
 * Deliberately not a general JSON Schema engine: it only understands the
 * keywords used in lib/aiSchemas.ts, and reports anything else as unsupported.
 */

import type { JsonSchema } from '@/lib/aiSchemas'

export interface SchemaViolation {
  path: string
  message: string
}

const SUPPORTED_KEYWORDS = new Set([
  'type',
  'properties',
  'required',
  'additionalProperties',
  'items',
  'minItems',
  'anyOf',
  'enum',
  'const',
  'description',
  'title',
  'format',
  '$defs',
  '$ref',
  'default',
  'pattern',
])

const SUPPORTED_TYPES = new Set(['object', 'array', 'string', 'number', 'integer', 'boolean', 'null'])

function typesOf(schema: JsonSchema): string[] {
  const t = schema.type
  if (typeof t === 'string') return [t]
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === 'string')
  return []
}

/** Structural problems that make a schema unsafe to send to Anthropic. */
export function findSchemaIncompatibilities(schema: JsonSchema, path = '$'): SchemaViolation[] {
  const out: SchemaViolation[] = []

  for (const key of Object.keys(schema)) {
    if (!SUPPORTED_KEYWORDS.has(key)) {
      out.push({ path, message: `unsupported keyword "${key}" (the API drops it into description)` })
    }
  }

  for (const t of typesOf(schema)) {
    if (!SUPPORTED_TYPES.has(t)) out.push({ path, message: `unsupported type "${t}"` })
  }

  if (schema.minItems !== undefined && schema.minItems !== 0 && schema.minItems !== 1) {
    out.push({ path, message: 'minItems must be 0 or 1' })
  }

  const props = schema.properties as Record<string, JsonSchema> | undefined
  if (props) {
    if (schema.additionalProperties !== false) {
      out.push({ path, message: 'objects must set additionalProperties: false' })
    }
    const required = Array.isArray(schema.required) ? (schema.required as string[]) : []
    for (const name of Object.keys(props)) {
      if (!required.includes(name)) {
        out.push({ path, message: `property "${name}" is missing from required` })
      }
      out.push(...findSchemaIncompatibilities(props[name], `${path}.${name}`))
    }
    for (const name of required) {
      if (!(name in props)) {
        out.push({ path, message: `required lists "${name}" which is not a property` })
      }
    }
  }

  if (schema.items && typeof schema.items === 'object') {
    out.push(...findSchemaIncompatibilities(schema.items as JsonSchema, `${path}[]`))
  }

  if (Array.isArray(schema.anyOf)) {
    ;(schema.anyOf as JsonSchema[]).forEach((sub, i) => {
      out.push(...findSchemaIncompatibilities(sub, `${path}|${i}`))
    })
  }

  return out
}

function matchesType(value: unknown, t: string): boolean {
  switch (t) {
    case 'null':
      return value === null
    case 'array':
      return Array.isArray(value)
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value)
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value)
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
    case 'string':
      return typeof value === 'string'
    case 'boolean':
      return typeof value === 'boolean'
    default:
      return false
  }
}

/** Empty array means the value conforms. */
export function validateAgainstSchema(
  value: unknown,
  schema: JsonSchema,
  path = '$',
): SchemaViolation[] {
  const out: SchemaViolation[] = []

  if (Array.isArray(schema.anyOf)) {
    const branches = schema.anyOf as JsonSchema[]
    const anyMatch = branches.some(sub => validateAgainstSchema(value, sub, path).length === 0)
    if (!anyMatch) out.push({ path, message: 'value matches none of the anyOf branches' })
    return out
  }

  const types = typesOf(schema)
  if (types.length > 0 && !types.some(t => matchesType(value, t))) {
    out.push({ path, message: `expected ${types.join(' | ')}, got ${describe(value)}` })
    return out
  }

  if (Array.isArray(schema.enum) && !(schema.enum as unknown[]).includes(value)) {
    out.push({ path, message: `value ${JSON.stringify(value)} is not in enum` })
  }
  if ('const' in schema && value !== schema.const) {
    out.push({ path, message: `value must equal ${JSON.stringify(schema.const)}` })
  }

  const props = schema.properties as Record<string, JsonSchema> | undefined
  if (props && matchesType(value, 'object')) {
    const obj = value as Record<string, unknown>
    const required = Array.isArray(schema.required) ? (schema.required as string[]) : []
    for (const name of required) {
      if (!(name in obj)) out.push({ path: `${path}.${name}`, message: 'required property missing' })
    }
    if (schema.additionalProperties === false) {
      for (const name of Object.keys(obj)) {
        if (!(name in props)) {
          out.push({ path: `${path}.${name}`, message: 'property not allowed by schema' })
        }
      }
    }
    for (const [name, sub] of Object.entries(props)) {
      if (name in obj) out.push(...validateAgainstSchema(obj[name], sub, `${path}.${name}`))
    }
  }

  if (schema.items && matchesType(value, 'array')) {
    ;(value as unknown[]).forEach((entry, i) => {
      out.push(...validateAgainstSchema(entry, schema.items as JsonSchema, `${path}[${i}]`))
    })
  }

  return out
}

function describe(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}
