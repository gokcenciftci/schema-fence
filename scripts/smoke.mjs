import { spawnSync } from 'node:child_process';

function runCli(args, expectedStatus) {
  const result = spawnSync(process.execPath, ['dist/cli.js', ...args], {
    encoding: 'utf8',
  });

  if (result.error) throw result.error;
  if (result.status !== expectedStatus) {
    throw new Error(
      `Expected SchemaFence to exit ${expectedStatus}, received ${String(result.status)}. ${result.stderr}`,
    );
  }

  return result;
}

const compatible = runCli(
  [
    'diff',
    '--base',
    'examples/petstore-v1.yaml',
    '--candidate',
    'examples/petstore-v2-compatible.yaml',
    '--format',
    'json',
  ],
  0,
);
if (JSON.parse(compatible.stdout).summary.breaking !== 0) {
  throw new Error('Expected the compatible fixture to have no breaking changes.');
}

const breaking = runCli(
  [
    'diff',
    '--base',
    'examples/petstore-v1.yaml',
    '--candidate',
    'examples/petstore-v2-breaking.yaml',
    '--format',
    'json',
  ],
  1,
);
if (JSON.parse(breaking.stdout).summary.breaking === 0) {
  throw new Error('Expected the breaking fixture to produce at least one finding.');
}

console.log('CLI smoke checks passed.');
