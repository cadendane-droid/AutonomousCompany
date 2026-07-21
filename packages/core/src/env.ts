/**
 * Env access with loud failure. Never read process.env directly elsewhere —
 * a missing secret must fail naming the variable, not surface as `undefined`
 * three layers down.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `See .env.example for where to obtain it.`,
    );
  }
  return value;
}

export function optionalEnv(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}
