import {
  AOI_VERSION,
  type AoiEvent,
  type CheckSeverity,
  type ErrorCategory,
} from './types.js';

export type MetaOptions = {
  readonly tool: string;
  readonly toolVersion: string;
  readonly schemaName: string;
  readonly schemaVersion: string;
  readonly command: string;
  readonly extra?: Record<string, unknown>;
};

export type SummaryOptions = {
  readonly ok: boolean;
  readonly truncated?: boolean;
  readonly extra?: Record<string, unknown>;
};

export type ErrorEventOptions = {
  readonly code: string;
  readonly category: ErrorCategory;
  readonly message: string;
  readonly retryable: boolean;
  readonly extra?: Record<string, unknown>;
};

export type WarningOptions = {
  readonly code?: string;
  readonly message: string;
  readonly extra?: Record<string, unknown>;
};

export type CheckOptions = {
  readonly name: string;
  readonly ok: boolean;
  readonly severity?: CheckSeverity;
  readonly detail?: string;
  readonly extra?: Record<string, unknown>;
};

/**
 * AOI event emitter. Writes one compact JSON object per line to a stream
 * (defaults to stdout), maintains running counts, and handles SIGPIPE
 * cleanly so a downstream pipe close produces an exit 141 instead of a
 * stack trace.
 *
 * Typical use:
 *
 *   import { Emitter } from 'aoi-cli-sdk-ts';
 *
 *   const e = new Emitter();
 *   e.meta({ tool: 'mytool', toolVersion: '1.0.0', schemaName: '…',
 *            schemaVersion: '1.0.0', command: 'search' });
 *   e.emit({ type: 'hit', rank: 1, id: 'doc_1' });
 *   e.summary({ ok: true });
 */
export class Emitter {
  #out: NodeJS.WriteStream;
  #counts = { events: 0, warnings: 0, errors: 0 };
  #startedAt: number;

  constructor(out: NodeJS.WriteStream = process.stdout) {
    this.#out = out;
    this.#startedAt = Date.now();
    out.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EPIPE') process.exit(141);
      throw err;
    });
  }

  /** Emit any AOI event. Auto-counts warnings and errors by type. */
  emit(event: AoiEvent): void {
    if (event.type === 'aoi:warning') this.#counts.warnings += 1;
    if (event.type === 'aoi:error') this.#counts.errors += 1;
    this.#counts.events += 1;
    this.#out.write(JSON.stringify(event) + '\n');
  }

  /** Convenience: emit the opening `aoi:meta` event. */
  meta(opts: MetaOptions): void {
    this.emit({
      type: 'aoi:meta',
      tool: opts.tool,
      tool_version: opts.toolVersion,
      aoi_version: AOI_VERSION,
      schema_name: opts.schemaName,
      schema_version: opts.schemaVersion,
      command: opts.command,
      ...(opts.extra ?? {}),
    });
  }

  /**
   * Convenience: emit the terminal `aoi:summary` event. Auto-fills count,
   * warning_count, error_count, and elapsed_ms (since the Emitter was
   * constructed). +1 is added to count to include this summary itself.
   */
  summary(opts: SummaryOptions): void {
    this.emit({
      type: 'aoi:summary',
      ok: opts.ok,
      count: this.#counts.events + 1,
      warning_count: this.#counts.warnings,
      error_count: this.#counts.errors,
      truncated: opts.truncated ?? false,
      elapsed_ms: Date.now() - this.#startedAt,
      ...(opts.extra ?? {}),
    });
  }

  /** Convenience: emit a structured `aoi:error` event. */
  error(opts: ErrorEventOptions): void {
    this.emit({
      type: 'aoi:error',
      code: opts.code,
      category: opts.category,
      message: opts.message,
      retryable: opts.retryable,
      ...(opts.extra ?? {}),
    });
  }

  /** Convenience: emit a `aoi:warning` event. */
  warning(opts: WarningOptions): void {
    this.emit({
      type: 'aoi:warning',
      message: opts.message,
      ...(opts.code !== undefined ? { code: opts.code } : {}),
      ...(opts.extra ?? {}),
    });
  }

  /** Convenience: emit a `aoi:check` event (typically from a doctor command). */
  check(opts: CheckOptions): void {
    this.emit({
      type: 'aoi:check',
      name: opts.name,
      ok: opts.ok,
      severity: opts.severity ?? (opts.ok ? 'info' : 'error'),
      ...(opts.detail !== undefined ? { detail: opts.detail } : {}),
      ...(opts.extra ?? {}),
    });
  }

  /** Read-only counts since this Emitter was constructed. */
  counts(): { readonly events: number; readonly warnings: number; readonly errors: number } {
    return { ...this.#counts };
  }
}
