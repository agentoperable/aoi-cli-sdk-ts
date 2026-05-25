import { spawn } from 'node:child_process';

export type RunResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
};

export type RunOptions = {
  readonly cwd?: string;
  readonly timeoutMs?: number;
  readonly env?: NodeJS.ProcessEnv;
};

/**
 * Spawn a subprocess and capture its complete stdout/stderr + exit code.
 * Returns when the process exits cleanly OR is killed by a timeout. Throws
 * only for spawn errors or timeout (which kills the child with SIGTERM).
 *
 * Used by aoi-lint to invoke target tools for conformance checking and by
 * machinemode to invoke wrapped upstream tools.
 */
export function runCommand(
  cmd: string,
  args: ReadonlyArray<string>,
  opts: RunOptions = {},
): Promise<RunResult> {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, [...args], {
      cwd: opts.cwd ?? process.cwd(),
      env: opts.env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      reject(new Error(`command timed out after ${timeoutMs}ms: ${cmd} ${args.join(' ')}`));
    }, timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => (stdout += chunk));
    child.stderr.on('data', (chunk: string) => (stderr += chunk));

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code ?? 0 });
    });
  });
}
