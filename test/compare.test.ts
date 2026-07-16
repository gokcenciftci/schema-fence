import { describe, expect, it } from 'vitest';
import { compareOpenApi } from '../src/compare/compare.js';
import { loadSpec } from '../src/io/load-spec.js';
import { examplePath, fixturePath } from './helpers.js';

describe('compareOpenApi', () => {
  it('reports a stable set of consumer-breaking changes', async () => {
    const baseline = await loadSpec(examplePath('petstore-v1.yaml'));
    const candidate = await loadSpec(examplePath('petstore-v2-breaking.yaml'));

    const result = compareOpenApi(baseline, candidate);

    expect(result.summary.breaking).toBe(7);
    expect(result.findings.map((entry) => entry.code)).toEqual([
      'PARAMETER_NOW_REQUIRED',
      'REQUEST_BODY_NOW_REQUIRED',
      'REQUEST_ENUM_VALUE_REMOVED',
      'REQUEST_PROPERTY_NOW_REQUIRED',
      'RESPONSE_PROPERTY_REMOVED',
      'RESPONSE_SCHEMA_TYPE_CHANGED',
      'PATH_REMOVED',
    ]);
    expect(result.findings[0]).toMatchObject({ path: '/pets', method: 'post' });
    expect(result.findings.at(-1)).toMatchObject({ code: 'PATH_REMOVED', path: '/pets/{petId}' });
  });

  it('does not report key ordering or metadata-only changes as breaking', async () => {
    const baseline = await loadSpec(fixturePath('compatible.yaml'));
    const candidate = await loadSpec(fixturePath('compatible.json'));

    const result = compareOpenApi(baseline, candidate);

    expect(result.summary.breaking).toBe(0);
    expect(result.findings).toEqual([]);
  });

  it('treats removal of an OpenAPI 2XX response range as breaking', async () => {
    const baseline = await loadSpec(fixturePath('response-range-base.yaml'));
    const candidate = await loadSpec(fixturePath('response-range-candidate.yaml'));

    const result = compareOpenApi(baseline, candidate);

    expect(result.findings).toContainEqual(
      expect.objectContaining({ code: 'SUCCESS_RESPONSE_REMOVED', location: 'responses.2XX' }),
    );
  });
});
