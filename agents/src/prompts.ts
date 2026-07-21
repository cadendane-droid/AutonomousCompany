// TIER A: loads role system prompts from prompts/*.md at runtime.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RoleName } from '@atlas/core';

const here = dirname(fileURLToPath(import.meta.url));

export function loadPrompt(role: RoleName): string {
  return readFileSync(join(here, 'prompts', `${role}.md`), 'utf8');
}
