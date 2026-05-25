/**
 * Type vocabulary for AOI-CLI events.
 *
 * Framework event types use the `aoi:` prefix per spec § 8.2. Domain event
 * types stay unprefixed and are scoped to whatever schema_name the tool
 * declared in its meta event.
 */

/** The base shape every AOI event satisfies. */
export type AoiEvent = {
  readonly type: string;
  readonly [key: string]: unknown;
};

/** The opening event for any finite operation. */
export type AoiMeta = AoiEvent & {
  readonly type: 'aoi:meta';
  readonly tool: string;
  readonly tool_version: string;
  readonly aoi_version: string;
  readonly schema_name: string;
  readonly schema_version: string;
  readonly command: string;
};

/** The terminal event for any finite operation. */
export type AoiSummary = AoiEvent & {
  readonly type: 'aoi:summary';
  readonly ok: boolean;
  readonly count: number;
  readonly warning_count: number;
  readonly error_count: number;
  readonly truncated?: boolean;
  readonly elapsed_ms?: number;
};

/** Structured error event. */
export type AoiError = AoiEvent & {
  readonly type: 'aoi:error';
  readonly code: string;
  readonly category: ErrorCategory;
  readonly message: string;
  readonly retryable: boolean;
};

/** Recoverable issue; operation continues. */
export type AoiWarning = AoiEvent & {
  readonly type: 'aoi:warning';
  readonly message: string;
};

/** Readiness check, typically from a `doctor` command. */
export type AoiCheck = AoiEvent & {
  readonly type: 'aoi:check';
  readonly name: string;
  readonly ok: boolean;
  readonly severity: CheckSeverity;
};

/** One planned side effect, typically emitted during `--dry-run`. */
export type AoiPlan = AoiEvent & {
  readonly type: 'aoi:plan';
  readonly action: string;
};

/** Long-running progress signal. Use sparingly. */
export type AoiProgress = AoiEvent & {
  readonly type: 'aoi:progress';
};

/** Liveness signal for unbounded streams. */
export type AoiHeartbeat = AoiEvent & {
  readonly type: 'aoi:heartbeat';
  readonly at: string;
};

/**
 * The standard error category taxonomy (spec § 9.1). Tools may define
 * domain-specific `code` values but SHOULD map them to one of these
 * categories so portable consumer retry logic works.
 */
export type ErrorCategory =
  | 'usage'
  | 'validation'
  | 'authn'
  | 'authz'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'temporary'
  | 'timeout'
  | 'cancelled'
  | 'partial'
  | 'internal'
  | 'config'
  | 'io';

/** Whether a category implies retry may help. Convenience for consumers. */
export const RETRYABLE_BY_DEFAULT: Readonly<Record<ErrorCategory, boolean>> = {
  usage: false,
  validation: false,
  authn: false, // may be true after reauth — case-by-case
  authz: false,
  not_found: false,
  conflict: false, // may be true after reconciling — case-by-case
  rate_limited: true,
  temporary: true,
  timeout: true,
  cancelled: false,
  partial: false,
  internal: false,
  config: false,
  io: false,
};

export type CheckSeverity = 'info' | 'warn' | 'error';

/** The AOI protocol version this SDK targets. */
export const AOI_VERSION = '0.2' as const;
