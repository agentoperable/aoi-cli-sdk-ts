# aoi-cli-sdk-ts

TypeScript SDK for building **AOI-CLI** tools — event emitter, types, error categories, subprocess helpers, JSONL consumer.

For the standard, see <https://machinemode.io>.

## Install

```bash
npm i aoi-cli-sdk-ts
# or
pnpm add aoi-cli-sdk-ts
```

## Minimal source (greenfield CLI that emits AOI)

```ts
#!/usr/bin/env node
import { Emitter } from 'aoi-cli-sdk-ts';

const emitter = new Emitter();
emitter.meta({
  tool: 'mytool',
  toolVersion: '1.0.0',
  schemaName: 'com.example.mytool.events',
  schemaVersion: '1.0.0',
  command: 'search',
});

for (let i = 0; i < 3; i++) {
  emitter.emit({ type: 'hit', rank: i + 1, id: `doc_${i}` });
}

emitter.summary({ ok: true });
```

That's it. The emitter:
- writes one compact JSON object per line to stdout
- auto-includes `aoi_version` in `meta`
- auto-counts events, warnings, errors
- auto-includes `count`, `warning_count`, `error_count`, `elapsed_ms` in `summary`
- handles SIGPIPE cleanly (exit 141 on downstream pipe close, no stack trace)

## Minimal transformer (consumer that reads JSONL on stdin, emits JSONL on stdout)

```ts
#!/usr/bin/env node
import { Emitter, consume } from 'aoi-cli-sdk-ts';

const emitter = new Emitter();
emitter.meta({
  tool: 'shout',
  toolVersion: '1.0.0',
  schemaName: 'com.example.shout.events',
  schemaVersion: '1.0.0',
  command: 'shout',
  extra: { input_schemas: ['com.example.outline.events@1.0.0'] },
});

let count = 0;

await consume({
  onEvent: (event) => {
    if (event.type === 'hit') {
      emitter.emit({
        type: 'shouted',
        source_id: event.id,
        title: String(event.title ?? '').toUpperCase(),
      });
      count += 1;
    }
  },
});

emitter.summary({ ok: true, extra: { input_processed: count } });
```

## Subprocess helper (for wrappers and linters)

```ts
import { runCommand } from 'aoi-cli-sdk-ts';

const result = await runCommand('ls', ['-la', '/var/log'], { timeoutMs: 5000 });
// result.stdout, result.stderr, result.exitCode
```

Captures complete stdout and stderr, returns exit code. Used by `aoi-lint` to invoke target tools and by `machinemode` to invoke wrapped upstreams.

## What's in the box

| Export | Purpose |
|---|---|
| `Emitter` | The class. `emit`, `meta`, `summary`, `error`, `warning`, `check`, `counts`. |
| `consume(handlers, opts?)` | Read a JSONL stream from stdin, dispatch each parsed event to your handler. |
| `runCommand(cmd, args, opts?)` | Spawn a subprocess, capture stdout/stderr/exit, return when done or timeout. |
| `AOI_VERSION` | The protocol version this SDK targets (`'0.2'`). |
| `RETRYABLE_BY_DEFAULT` | Map from `ErrorCategory` → boolean. Convenience for portable retry logic. |
| **Types** | `AoiEvent`, `AoiMeta`, `AoiSummary`, `AoiError`, `AoiWarning`, `AoiCheck`, `AoiPlan`, `AoiProgress`, `AoiHeartbeat`, `ErrorCategory`, `CheckSeverity` |

## Framework type vocabulary

Framework events use the `aoi:` prefix per [spec § 8.2](https://machinemode.io/spec#8-event-model):
- `aoi:meta` — opens every finite operation
- `aoi:summary` — terminates every finite operation
- `aoi:warning` — recoverable issue, operation continues
- `aoi:error` — structured failure
- `aoi:check` — readiness/doctor check
- `aoi:plan` — planned side effect (typically from `--dry-run`)
- `aoi:progress` — long-running progress
- `aoi:heartbeat` — liveness signal for unbounded streams

Domain events stay unprefixed and are scoped to the schema declared in `meta.schema_name`.

## Standard error categories

The SDK exports the standard error category taxonomy from [spec § 9.1](https://machinemode.io/spec#9-error-taxonomy). When emitting an error, pick one:

```ts
emitter.error({
  code: 'RATE_LIMITED',
  category: 'rate_limited',   // ← from the standard taxonomy
  message: 'API rate limit exceeded',
  retryable: true,
  extra: { retry_after_ms: 7200 },
});
```

Available categories: `usage` `validation` `authn` `authz` `not_found` `conflict` `rate_limited` `temporary` `timeout` `cancelled` `partial` `internal` `config` `io`.

## Related

| Repo | What |
|---|---|
| [agentoperable/aoi-lint](https://github.com/agentoperable/aoi-lint) | Conformance checker for AOI-CLI tools. Uses this SDK. |
| [agentoperable/machinemode](https://github.com/agentoperable/machinemode) | Wrappers around the system's coreutils. Uses this SDK. |
| [agentoperable/aoi-coreutils](https://github.com/agentoperable/aoi-coreutils) | Native AOI re-impls of common Unix utilities. Uses this SDK. |

## Status

**v0.1** — covers the most common AOI source/transformer/sink patterns. Future work:
- runtime schema validation against discovered JSON Schemas
- redaction helpers for `meta.args`
- Session Mode (JSON-RPC over NDJSON-framed stdio) helpers
- input-schema declaration for transformers and sinks

## License

MIT
