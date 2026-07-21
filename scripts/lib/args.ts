// TIER A: argument parsing shared by the scripts. Pure.
import process from 'node:process';

/** Value of --name, or undefined. */
export function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  return value && !value.startsWith('--') ? value : undefined;
}

/** Value of --name, or exit with a usage message naming what was missing. */
export function requireArg(name: string, usage: string): string {
  const value = arg(name);
  if (value === undefined) {
    console.error(`Missing required --${name}\n\n${usage}`);
    process.exit(2);
  }
  return value;
}

export function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

/** Run a script body, print a clean error, and always close the pool. */
export async function run(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    const { closePool } = await import('@atlas/db');
    await closePool();
  }
}
