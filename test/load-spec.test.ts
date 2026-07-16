import { describe, expect, it } from 'vitest';
import { SpecError } from '../src/core/errors.js';
import { loadSpec } from '../src/io/load-spec.js';
import { fixturePath } from './helpers.js';

describe('loadSpec', () => {
  it('loads a local YAML OpenAPI 3 document', async () => {
    const document = await loadSpec(fixturePath('compatible.yaml'));

    expect(document.openapi).toBe('3.0.3');
    expect(document.info.title).toBe('Inventory API');
  });

  it('loads an equivalent JSON document', async () => {
    const document = await loadSpec(fixturePath('compatible.json'));

    expect(document.openapi).toBe('3.0.3');
    expect(document.paths['/items']).toBeDefined();
  });

  it('rejects external references instead of fetching them', async () => {
    await expect(loadSpec(fixturePath('external-reference.yaml'))).rejects.toThrow(
      'external $ref values are not supported',
    );
  });

  it('rejects cyclic YAML aliases before comparison', async () => {
    await expect(loadSpec(fixturePath('cyclic-alias.yaml'))).rejects.toThrow(
      'cyclic YAML aliases are not supported',
    );
  });

  it('normalizes invalid YAML as a specification error', async () => {
    await expect(loadSpec(fixturePath('invalid.yaml'))).rejects.toBeInstanceOf(SpecError);
  });

  it('rejects a local reference whose pointer does not exist', async () => {
    await expect(loadSpec(fixturePath('missing-local-reference.yaml'))).rejects.toThrow(
      "could not resolve local $ref '#/components/schemas/Missing'",
    );
  });

  it('limits v0.1 to OpenAPI 3.0 documents', async () => {
    await expect(loadSpec(fixturePath('openapi-31.yaml'))).rejects.toThrow(
      'only OpenAPI 3.0.x documents are supported',
    );
  });

  it('rejects direct cyclic local reference chains', async () => {
    await expect(loadSpec(fixturePath('cyclic-reference.yaml'))).rejects.toThrow(
      'cyclic local $ref chains are not supported',
    );
  });
});
