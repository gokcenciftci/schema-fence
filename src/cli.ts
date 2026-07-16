#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { runDiff } from './application/diff.js';
import { SpecError, UsageError } from './core/errors.js';
import type { DiffOptions, ReportFormat } from './core/types.js';
import { formatJson, formatText } from './report/report.js';

const HELP = `SchemaFence v0.1.0

Usage:
  schema-fence diff --base <openapi.yaml|json> --candidate <openapi.yaml|json> [--format text|json]

Exit codes:
  0  Compatible: no breaking changes found
  1  Breaking changes found
  2  Invalid command or arguments
  3  Input file or OpenAPI validation error
 70  Unexpected tool error
`;

export interface CliIo {
  readonly stdout: { write(message: string): boolean };
  readonly stderr: { write(message: string): boolean };
}

function nextValue(args: readonly string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new UsageError(`${flag} requires a file path.`);
  return value;
}

export function parseArgs(args: readonly string[]): DiffOptions | 'help' {
  if (process.env.INPUT_BASE && process.env.INPUT_CANDIDATE) {
    const baselinePath = process.env.INPUT_BASE;
    const candidatePath = process.env.INPUT_CANDIDATE;
    const format = (process.env.INPUT_FORMAT === 'json' ? 'json' : 'text') as ReportFormat;
    return { baselinePath, candidatePath, format };
  }

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') return 'help';
  if (args[0] !== 'diff') throw new UsageError(`Unknown command '${args[0]}'. Use 'diff'.`);

  let baselinePath: string | undefined;
  let candidatePath: string | undefined;
  let format: ReportFormat = 'text';

  for (let index = 1; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--base') {
      baselinePath = nextValue(args, index, argument);
      index += 1;
    } else if (argument === '--candidate') {
      candidatePath = nextValue(args, index, argument);
      index += 1;
    } else if (argument === '--format') {
      const value = nextValue(args, index, argument);
      if (value !== 'text' && value !== 'json') {
        throw new UsageError("--format must be 'text' or 'json'.");
      }
      format = value;
      index += 1;
    } else if (argument === '--help' || argument === '-h') {
      return 'help';
    } else {
      throw new UsageError(`Unknown argument '${argument}'.`);
    }
  }

  if (!baselinePath || !candidatePath) {
    throw new UsageError('Both --base and --candidate are required.');
  }

  return { baselinePath, candidatePath, format };
}

export async function runCli(args: readonly string[], io: CliIo): Promise<number> {
  try {
    const options = parseArgs(args);
    if (options === 'help') {
      io.stdout.write(HELP);
      return 0;
    }

    const result = await runDiff(options);
    io.stdout.write(options.format === 'json' ? formatJson(result) : formatText(result));
    return result.summary.breaking > 0 ? 1 : 0;
  } catch (error) {
    if (error instanceof UsageError) {
      io.stderr.write(`Usage error: ${error.message}\n\n${HELP}`);
      return 2;
    }
    if (error instanceof SpecError) {
      io.stderr.write(`Specification error: ${error.message}\n`);
      return 3;
    }
    io.stderr.write('Unexpected error: SchemaFence could not complete the comparison.\n');
    return 70;
  }
}

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) {
  void runCli(process.argv.slice(2), process).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
