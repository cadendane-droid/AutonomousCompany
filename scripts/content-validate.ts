// TIER A: fully working. Validates every content file's frontmatter against
// the canonical schema in @atlas/core — the same schema the Policy Engine and
// the site enforce, so this cannot drift from either.
//
// Usage: pnpm content:validate [--dir site/src/content] [--tenant tenant-alpha]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import process from 'node:process';
import { parse as parseYaml } from 'yaml';
import { FrontmatterSchema } from '@atlas/core';
import { arg } from './lib/args.ts';

const root = arg('dir') ?? 'site/src/content';
const tenant = arg('tenant');

function markdownFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...markdownFiles(path));
    else if (entry.endsWith('.md') || entry.endsWith('.mdx')) out.push(path);
  }
  return out;
}

function extractFrontmatter(raw: string): unknown {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (!match) throw new Error('no frontmatter block');
  return parseYaml(match[1]!);
}

const searchDir = tenant ? join(root, tenant) : root;
const files = markdownFiles(searchDir);

if (files.length === 0) {
  console.log(`no content files under ${searchDir}`);
  process.exit(0);
}

let failures = 0;

for (const file of files) {
  const shown = relative(process.cwd(), file);
  try {
    const data = extractFrontmatter(readFileSync(file, 'utf8'));
    const result = FrontmatterSchema.safeParse(data);
    if (result.success) {
      console.log(`ok    ${shown}`);
    } else {
      failures += 1;
      console.error(`FAIL  ${shown}`);
      for (const issue of result.error.issues) {
        console.error(`        ${issue.path.join('.') || '(root)'}: ${issue.message}`);
      }
    }
  } catch (err) {
    failures += 1;
    console.error(`FAIL  ${shown}\n        ${err instanceof Error ? err.message : err}`);
  }
}

console.log(`\n${files.length - failures}/${files.length} valid`);
if (failures > 0) process.exitCode = 1;
