/**
 * One entry point for every Claude call, so token spend is visible per feature
 * and transient failures are handled the same way everywhere.
 *
 * Retries are delegated to the Anthropic SDK, which already backs off
 * exponentially on 408/409/429/5xx and honours `retry-after` /
 * `retry-after-ms` / `x-should-retry`. Adding a second loop on top would
 * multiply the attempts, so this module only raises the retry budget above the
 * SDK default of 2 and records what each call cost.
 */

import Anthropic from '@anthropic-ai/sdk'
import type {
  BetaMessage,
  BetaUsage,
  MessageCreateParamsNonStreaming,
} from '@anthropic-ai/sdk/resources/beta/messages/messages'

/** Stable tags so usage lines can be grouped per feature. */
export type AiFeature =
  | 'food.photo-analyze'
  | 'food.photo-refine'
  | 'bloodwork.photo-analyze'
  | 'verdict.summary'

const DEFAULT_MAX_RETRIES = 4

export interface AiUsageRecord {
  feature: AiFeature
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  stopReason: BetaMessage['stop_reason']
  durationMs: number
  /** Only present when the price env vars are configured. */
  estimatedUsd: number | null
}

export class AiResponseError extends Error {
  constructor(
    message: string,
    readonly stopReason: BetaMessage['stop_reason'],
  ) {
    super(message)
    this.name = 'AiResponseError'
  }
}

export function getAnthropicClient(apiKey: string): Anthropic {
  const configured = Number(process.env.ANTHROPIC_MAX_RETRIES)
  return new Anthropic({
    apiKey,
    maxRetries: Number.isFinite(configured) && configured >= 0 ? configured : DEFAULT_MAX_RETRIES,
  })
}

/**
 * Prices are never hardcoded: rate cards change and a stale constant would
 * report confident nonsense. Set the env vars to get a cost estimate, or leave
 * them unset and read raw token counts.
 */
function estimateUsd(usage: BetaUsage): number | null {
  const inPer = Number(process.env.ANTHROPIC_PRICE_INPUT_PER_MTOK)
  const outPer = Number(process.env.ANTHROPIC_PRICE_OUTPUT_PER_MTOK)
  if (!Number.isFinite(inPer) || !Number.isFinite(outPer)) return null

  const cacheReadPer = Number(process.env.ANTHROPIC_PRICE_CACHE_READ_PER_MTOK)
  const cacheWritePer = Number(process.env.ANTHROPIC_PRICE_CACHE_WRITE_PER_MTOK)
  const cacheRead = usage.cache_read_input_tokens ?? 0
  const cacheWrite = usage.cache_creation_input_tokens ?? 0

  const cost =
    (usage.input_tokens / 1e6) * inPer +
    (usage.output_tokens / 1e6) * outPer +
    (cacheRead / 1e6) * (Number.isFinite(cacheReadPer) ? cacheReadPer : inPer) +
    (cacheWrite / 1e6) * (Number.isFinite(cacheWritePer) ? cacheWritePer : inPer)

  return Math.round(cost * 1e6) / 1e6
}

function recordUsage(record: AiUsageRecord): void {
  console.log(`[ai-usage] ${JSON.stringify(record)}`)
}

/** Concatenated text blocks of a message, trimmed. */
export function messageText(msg: BetaMessage): string {
  return msg.content
    .map(block => (block.type === 'text' ? block.text : ''))
    .join('')
    .trim()
}

export interface CallClaudeResult {
  message: BetaMessage
  text: string
  usage: AiUsageRecord
}

type JsonSchemaFormat = { type: 'json_schema'; schema: Record<string, unknown> }

/**
 * Anthropic GA moved structured outputs from `output_format` → `output_config.format`.
 * Installed SDK types still lag; accept both and always send the new shape.
 */
export type CallClaudeParams = Omit<MessageCreateParamsNonStreaming, 'output_format' | 'output_config'> & {
  output_config?: {
    effort?: 'low' | 'medium' | 'high' | null
    format?: JsonSchemaFormat
  }
  /** @deprecated Prefer `output_config.format` — auto-migrated in callClaude. */
  output_format?: JsonSchemaFormat | null
}

function normalizeStructuredOutputParams(
  params: CallClaudeParams,
): MessageCreateParamsNonStreaming {
  const { output_format, output_config, ...rest } = params
  const format = output_config?.format ?? output_format ?? undefined
  if (!format) {
    return {
      ...rest,
      ...(output_config ? { output_config } : {}),
    } as MessageCreateParamsNonStreaming
  }
  return {
    ...rest,
    output_config: {
      ...(output_config?.effort !== undefined ? { effort: output_config.effort } : {}),
      format,
    },
  } as MessageCreateParamsNonStreaming
}

/**
 * Runs a non-streaming beta message, logs usage under `feature`, and rejects
 * responses that cannot contain usable output.
 *
 * Throws AiResponseError when the model refused or ran out of tokens, so
 * callers can map that to a specific HTTP status instead of a parse failure.
 */
export async function callClaude(
  client: Anthropic,
  feature: AiFeature,
  params: CallClaudeParams,
): Promise<CallClaudeResult> {
  const startedAt = Date.now()
  const message = await client.beta.messages.create(normalizeStructuredOutputParams(params))

  const usage: AiUsageRecord = {
    feature,
    model: message.model,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    cacheCreationTokens: message.usage.cache_creation_input_tokens ?? 0,
    stopReason: message.stop_reason,
    durationMs: Date.now() - startedAt,
    estimatedUsd: estimateUsd(message.usage),
  }
  recordUsage(usage)

  if (message.stop_reason === 'refusal') {
    throw new AiResponseError('model refused the request', message.stop_reason)
  }
  if (message.stop_reason === 'max_tokens') {
    throw new AiResponseError('model output was cut off at max_tokens', message.stop_reason)
  }

  return { message, text: messageText(message), usage }
}
