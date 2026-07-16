import { describe, expect, it } from 'vitest';
import { parseArgs, runCli } from '../src/cli.js';
import { examplePath } from './helpers.js';

function memoryIo() {
  let stdout = '';
  let stderr = '';
  return {
    io: {
      stdout: { write: (message: string) => ((stdout += message), true) },
      stderr: { write: (message: string) => ((stderr += message), true) },
    },
    output: () => ({ stdout, stderr }),
  };
}

describe('parseArgs', () => {
  it('parses a deterministic diff command', () => {
    expect(
      parseArgs(['diff', '--base', 'before.yaml', '--candidate', 'after.yaml', '--format', 'json']),
    ).toEqual({ baselinePath: 'before.yaml', candidatePath: 'after.yaml', format: 'json' });
  });
});

describe('runCli', () => {
  it('writes a machine-readable report and exits 1 for breaking changes', async () => {
    const memory = memoryIo();
    const exitCode = await runCli(
      [
        'diff',
        '--base',
        examplePath('petstore-v1.yaml'),
        '--candidate',
        examplePath('petstore-v2-breaking.yaml'),
        '--format',
        'json',
      ],
      memory.io,
    );

    const { stdout, stderr } = memory.output();
    expect(exitCode).toBe(1);
    expect(stderr).toBe('');
    expect(JSON.parse(stdout)).toMatchObject({ schemaVersion: '1.0', summary: { breaking: 7 } });
  });

  it('explains invalid command input without throwing', async () => {
    const memory = memoryIo();
    const exitCode = await runCli(['diff', '--base', 'before.yaml'], memory.io);

    expect(exitCode).toBe(2);
    expect(memory.output().stderr).toContain('Both --base and --candidate are required.');
  });
});
