import { describe, expect, it } from 'vitest';
import { formatJson, formatText } from '../src/report/report.js';
import type { ComparisonResult } from '../src/core/types.js';

const result: ComparisonResult = {
  schemaVersion: '1.0',
  baseline: { title: 'Inventory API', version: '1.0.0', openapi: '3.0.3' },
  candidate: { title: 'Inventory API', version: '2.0.0', openapi: '3.0.3' },
  summary: { breaking: 1 },
  findings: [
    {
      code: 'OPERATION_REMOVED',
      severity: 'breaking',
      path: '/items/{id}',
      method: 'get',
      location: 'paths./items/{id}.get',
      summary: 'GET /items/{id} was removed.',
    },
  ],
};

describe('reporters', () => {
  it('formats a human-readable report', () => {
    expect(formatText(result)).toContain('[OPERATION_REMOVED] GET /items/{id}');
  });

  it('formats a stable JSON document', () => {
    expect(JSON.parse(formatJson(result))).toEqual(result);
  });

  it('reports a compatible comparison without findings', () => {
    expect(
      formatText({
        ...result,
        summary: { breaking: 0 },
        findings: [],
      }),
    ).toContain('No breaking changes found.');
  });
});
