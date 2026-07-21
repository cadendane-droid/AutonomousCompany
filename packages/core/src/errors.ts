/**
 * Thrown by Tier C modules — interface-only code whose shape can't be known
 * yet. Every throw site documents what unblocks it.
 */
export class NotImplementedError extends Error {
  constructor(what: string, unblockedBy: string) {
    super(`Not implemented: ${what}. Unblocked by: ${unblockedBy}`);
    this.name = 'NotImplementedError';
  }
}
