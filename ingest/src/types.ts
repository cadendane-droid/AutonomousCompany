// TIER A: pure connector interface types. No external dependencies.
export interface DateRange {
  /** Inclusive, yyyy-mm-dd. */
  from: string;
  /** Inclusive, yyyy-mm-dd. */
  to: string;
}

export interface ConnectorResult {
  rowsWritten: number;
}

/** Every connector exposes exactly this. runner.ts dispatches on it. */
export interface Connector {
  name: string;
  run(tenantId: string, range: DateRange): Promise<ConnectorResult>;
}