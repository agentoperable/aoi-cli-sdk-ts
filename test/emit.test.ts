import { equal, ok } from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';

import { Emitter } from '../src/emit.js';

function collect(): { stream: NodeJS.WriteStream; lines: () => string[] } {
  const chunks: string[] = [];
  const stream = new PassThrough() as unknown as NodeJS.WriteStream;
  stream.write = ((chunk: string | Buffer) => {
    chunks.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
    return true;
  }) as NodeJS.WriteStream['write'];
  return {
    stream,
    lines: () => chunks.join('').split('\n').filter((l) => l.length > 0),
  };
}

test('Emitter.meta emits aoi:meta with required fields', () => {
  const { stream, lines } = collect();
  const e = new Emitter(stream);
  e.meta({
    tool: 'x',
    toolVersion: '1.2.3',
    schemaName: 'com.example.x',
    schemaVersion: '1.0.0',
    command: 'search',
  });
  const event = JSON.parse(lines()[0]!) as Record<string, unknown>;
  equal(event.type, 'aoi:meta');
  equal(event.tool, 'x');
  equal(event.tool_version, '1.2.3');
  equal(event.aoi_version, '0.2');
  equal(event.schema_name, 'com.example.x');
  equal(event.schema_version, '1.0.0');
  equal(event.command, 'search');
});

test('Emitter.summary auto-fills counts and elapsed_ms', () => {
  const { stream, lines } = collect();
  const e = new Emitter(stream);
  e.emit({ type: 'hit' });
  e.emit({ type: 'hit' });
  e.warning({ message: 'something' });
  e.error({ code: 'X', category: 'internal', message: 'y', retryable: false });
  e.summary({ ok: false });
  const last = JSON.parse(lines().at(-1)!) as Record<string, unknown>;
  equal(last.type, 'aoi:summary');
  equal(last.ok, false);
  equal(last.warning_count, 1);
  equal(last.error_count, 1);
  // count = events + 1 (the summary itself); we emitted 4 prior events, so 5
  equal(last.count, 5);
  ok(typeof last.elapsed_ms === 'number' && (last.elapsed_ms as number) >= 0);
});

test('Emitter.error emits standard taxonomy fields', () => {
  const { stream, lines } = collect();
  const e = new Emitter(stream);
  e.error({
    code: 'RATE_LIMITED',
    category: 'rate_limited',
    message: 'slow down',
    retryable: true,
    extra: { retry_after_ms: 500 },
  });
  const event = JSON.parse(lines()[0]!) as Record<string, unknown>;
  equal(event.type, 'aoi:error');
  equal(event.code, 'RATE_LIMITED');
  equal(event.category, 'rate_limited');
  equal(event.message, 'slow down');
  equal(event.retryable, true);
  equal(event.retry_after_ms, 500);
});

test('Emitter.check defaults severity from ok', () => {
  const { stream, lines } = collect();
  const e = new Emitter(stream);
  e.check({ name: 'a', ok: true });
  e.check({ name: 'b', ok: false });
  const events = lines().map((l) => JSON.parse(l)) as Record<string, unknown>[];
  equal(events[0]!.severity, 'info');
  equal(events[1]!.severity, 'error');
});

test('Emitter outputs one compact JSON object per line', () => {
  const { stream, lines } = collect();
  const e = new Emitter(stream);
  e.emit({ type: 'a', x: 1 });
  e.emit({ type: 'b', y: 2 });
  const ls = lines();
  equal(ls.length, 2);
  equal(ls[0], '{"type":"a","x":1}');
  equal(ls[1], '{"type":"b","y":2}');
});

test('Emitter.counts reflects emitted events', () => {
  const { stream } = collect();
  const e = new Emitter(stream);
  e.emit({ type: 'hit' });
  e.warning({ message: '!' });
  e.warning({ message: '!' });
  e.error({ code: 'X', category: 'io', message: '!', retryable: false });
  const c = e.counts();
  equal(c.events, 4);
  equal(c.warnings, 2);
  equal(c.errors, 1);
});
