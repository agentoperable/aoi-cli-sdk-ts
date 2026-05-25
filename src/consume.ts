import { createInterface } from 'node:readline';

import type { AoiEvent } from './types.js';

export type ConsumeOptions = {
  /** Source of JSONL input. Defaults to process.stdin. */
  readonly input?: NodeJS.ReadableStream;
  /** What to do with lines that don't parse as JSON. Default: emit a parse warning and continue. */
  readonly onParseError?: 'continue' | 'throw';
};

export type ConsumeHandlers = {
  /** Called for each successfully-parsed event. Return value is ignored. */
  readonly onEvent: (event: AoiEvent, line: { number: number; raw: string }) => void | Promise<void>;
  /** Called once when the stream ends (EOF). */
  readonly onEnd?: () => void | Promise<void>;
  /** Called when a malformed JSON line is encountered. If onParseError is 'throw', this is called before throwing. */
  readonly onParseError?: (err: Error, line: { number: number; raw: string }) => void;
};

/**
 * Read a JSONL stream line by line, parse each line as JSON, and dispatch
 * to the handlers. The natural API for a transformer or sink — reads
 * upstream AOI events, dispatches on type, optionally emits its own events.
 *
 * Resolves when the input stream ends.
 *
 * Typical use:
 *
 *   import { consume, Emitter } from 'aoi-cli-sdk-ts';
 *
 *   const emitter = new Emitter();
 *   emitter.meta({ tool: 'summarize', ... });
 *
 *   await consume({
 *     onEvent: (event) => {
 *       if (event.type === 'hit') {
 *         emitter.emit({ type: 'abstract', source_id: event.id, ... });
 *       }
 *     },
 *   });
 *
 *   emitter.summary({ ok: true });
 */
export async function consume(
  handlers: ConsumeHandlers,
  opts: ConsumeOptions = {},
): Promise<void> {
  const input = opts.input ?? process.stdin;
  const mode = opts.onParseError ?? 'continue';

  return new Promise((resolve, reject) => {
    const rl = createInterface({ input, crlfDelay: Infinity });
    let lineNumber = 0;
    let cancelled = false;

    rl.on('line', (raw) => {
      if (cancelled) return;
      lineNumber += 1;
      const trimmed = raw.trim();
      if (trimmed === '') return;

      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch (err) {
        const parseErr = err instanceof Error ? err : new Error(String(err));
        handlers.onParseError?.(parseErr, { number: lineNumber, raw });
        if (mode === 'throw') {
          cancelled = true;
          rl.close();
          reject(parseErr);
        }
        return;
      }

      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        const err = new Error(`line ${lineNumber} is not a JSON object`);
        handlers.onParseError?.(err, { number: lineNumber, raw });
        if (mode === 'throw') {
          cancelled = true;
          rl.close();
          reject(err);
        }
        return;
      }

      const event = parsed as AoiEvent;
      if (typeof event.type !== 'string') {
        const err = new Error(`line ${lineNumber}: event is missing string \`type\` field`);
        handlers.onParseError?.(err, { number: lineNumber, raw });
        if (mode === 'throw') {
          cancelled = true;
          rl.close();
          reject(err);
        }
        return;
      }

      const result = handlers.onEvent(event, { number: lineNumber, raw });
      if (result instanceof Promise) {
        result.catch((handlerErr: unknown) => {
          cancelled = true;
          rl.close();
          reject(handlerErr instanceof Error ? handlerErr : new Error(String(handlerErr)));
        });
      }
    });

    rl.on('close', () => {
      if (cancelled) return;
      const endResult = handlers.onEnd?.();
      if (endResult instanceof Promise) {
        endResult.then(resolve).catch(reject);
      } else {
        resolve();
      }
    });

    rl.on('error', (err) => {
      if (cancelled) return;
      cancelled = true;
      reject(err);
    });
  });
}
