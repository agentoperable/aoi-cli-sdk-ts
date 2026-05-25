/**
 * aoi-cli-sdk-ts — TypeScript SDK for building AOI-CLI tools.
 *
 * https://github.com/agentoperable/aoi-cli-sdk-ts
 * https://machinemode.io/spec
 */

export {
  Emitter,
  type CheckOptions,
  type ErrorEventOptions,
  type MetaOptions,
  type SummaryOptions,
  type WarningOptions,
} from './emit.js';

export { runCommand, type RunOptions, type RunResult } from './run.js';

export { consume, type ConsumeHandlers, type ConsumeOptions } from './consume.js';

export {
  AOI_VERSION,
  RETRYABLE_BY_DEFAULT,
  type AoiCheck,
  type AoiError,
  type AoiEvent,
  type AoiHeartbeat,
  type AoiMeta,
  type AoiPlan,
  type AoiProgress,
  type AoiSummary,
  type AoiWarning,
  type CheckSeverity,
  type ErrorCategory,
} from './types.js';
