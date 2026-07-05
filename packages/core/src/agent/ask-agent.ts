import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import type { JsonlLogger } from '../logging/jsonl-logger'
import { SIMPLE_SYSTEM_PROMPT } from './simple-system-prompt'

const QuestionSchema = z.string().min(1, 'A kérdés nem lehet üres.')

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type Usage = {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export type AskAgentConfig = {
  apiKey: string
  model: string
  logger?: JsonlLogger
}

export type AskAgentResult = {
  answer: string
  systemPrompt: string
  messages: ChatMessage[]
  usage: Usage
}

export async function askAgent(question: string, config: AskAgentConfig): Promise<AskAgentResult> {
  const parsedQuestion = QuestionSchema.parse(question)
  const startedAt = Date.now()

  const client = new Anthropic({ apiKey: config.apiKey })
  const messages: ChatMessage[] = [{ role: 'user', content: parsedQuestion }]

  let answer = ''
  let usage: Usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
  let errorMessage: string | undefined

  try {
    const response = await client.messages.create({
      model: config.model,
      max_tokens: 1024,
      system: SIMPLE_SYSTEM_PROMPT,
      messages,
    })

    answer = response.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .filter(Boolean)
      .join('\n')

    usage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    }

    return { answer, systemPrompt: SIMPLE_SYSTEM_PROMPT, messages, usage }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Ismeretlen hiba történt.'
    throw error
  } finally {
    config.logger?.append({
      timestamp: new Date().toISOString(),
      question: parsedQuestion,
      systemPrompt: SIMPLE_SYSTEM_PROMPT,
      messages,
      toolCalls: [],
      finalAnswer: answer,
      usage,
      durationMs: Date.now() - startedAt,
      error: errorMessage,
    })
  }
}
