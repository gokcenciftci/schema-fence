import type { ComparisonResult, Finding } from '../core/types.js';

function formatFinding(finding: Finding): string {
  const operation = finding.method
    ? ` ${finding.method.toUpperCase()} ${finding.path}`
    : ` ${finding.path}`;
  return `  [${finding.code}]${operation}\n    ${finding.summary}`;
}

export function formatText(result: ComparisonResult): string {
  const header = [
    'SchemaFence — OpenAPI compatibility report',
    `Baseline: ${result.baseline.title} v${result.baseline.version} (OpenAPI ${result.baseline.openapi})`,
    `Candidate: ${result.candidate.title} v${result.candidate.version} (OpenAPI ${result.candidate.openapi})`,
    '',
  ];

  if (result.findings.length === 0) {
    return [...header, '✓ No breaking changes found.'].join('\n') + '\n';
  }

  return (
    [
      ...header,
      `✖ ${result.summary.breaking} breaking change${result.summary.breaking === 1 ? '' : 's'} found:`,
      ...result.findings.map(formatFinding),
    ].join('\n') + '\n'
  );
}

export function formatJson(result: ComparisonResult): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}
