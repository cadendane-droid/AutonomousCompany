// TIER B: logic complete, untested against live API.
//
// Structured output helper: prompt for JSON, parse, validate with Zod, retry
// ONCE with the validation error in-context, then fail loudly. An agent
// returning malformed JSON must fail at this boundary, never propagate.
import type { z } from 'zod';
import { callLlm, type LlmCallInput } from './client.js';

export class StructuredOutputError extends Error {
  constructor(taskKind: string, detail: string) {
    super(`Structured output failed for task "${taskKind}" after retry: ${detail}`);
    this.name = 'StructuredOutputError';
  }
}

function extractJson(text: string): string {
  // Tolerate a fenced block; otherwise expect raw JSON.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced?.[1] ?? text).trim();
}

export async function callLlmStructured<T>(
  input: LlmCallInput,
  schema: z.ZodType<T>,
): Promise<T> {
  const jsonInstruction =
    '\n\nRespond with a single JSON object only — no prose before or after. ' +
    'It must conform exactly to the schema described above.';

  let lastError = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt =
      attempt === 0
        ? input.prompt + jsonInstruction
        : `${input.prompt}${jsonInstruction}\n\nYour previous response failed validation: ${lastError}\nEmit corrected JSON only.`;

    const result = await callLlm({ ...input, prompt });

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJson(result.text));
    } catch (err) {
      lastError = `not valid JSON: ${err instanceof Error ? err.message : err}`;
      continue;
    }

    const validated = schema.safeParse(parsed);
    if (validated.success) return validated.data;
    lastError = validated.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
  }

  throw new StructuredOutputError(input.taskKind, lastError);
}
