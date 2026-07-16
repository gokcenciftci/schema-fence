import { open } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { parseAllDocuments } from 'yaml';
import { SpecError } from '../core/errors.js';
import type { OpenApiDocument } from '../core/types.js';
import { validateOpenApiDocument } from '../openapi/validate.js';

const MAX_SPEC_BYTES = 5 * 1024 * 1024;

function parseJson(source: string, location: string): unknown {
  try {
    return JSON.parse(source) as unknown;
  } catch {
    throw new SpecError(`${location}: invalid JSON.`);
  }
}

function parseYaml(source: string, location: string): unknown {
  let documents;
  try {
    documents = parseAllDocuments(source);
  } catch {
    throw new SpecError(`${location}: invalid YAML.`);
  }
  if (documents.length !== 1) {
    throw new SpecError(`${location}: expected exactly one YAML document.`);
  }

  const [document] = documents;
  if (!document || document.errors.length > 0) {
    throw new SpecError(`${location}: invalid YAML.`);
  }

  try {
    return document.toJS({ maxAliasCount: 100 });
  } catch {
    throw new SpecError(`${location}: invalid YAML.`);
  }
}

export async function loadSpec(filePath: string): Promise<OpenApiDocument> {
  const resolvedPath = resolve(filePath);
  let handle: FileHandle;
  try {
    handle = await open(resolvedPath, 'r');
  } catch {
    throw new SpecError(`${resolvedPath}: could not open specification file.`);
  }

  try {
    const metadata = await handle.stat();
    if (!metadata.isFile()) {
      throw new SpecError(`${resolvedPath}: expected a file.`);
    }
    if (metadata.size > MAX_SPEC_BYTES) {
      throw new SpecError(`${resolvedPath}: specification exceeds the 5 MiB safety limit.`);
    }

    let contents: string;
    try {
      contents = await handle.readFile({ encoding: 'utf8' });
    } catch {
      throw new SpecError(`${resolvedPath}: could not read specification file.`);
    }
    if (Buffer.byteLength(contents, 'utf8') > MAX_SPEC_BYTES) {
      throw new SpecError(`${resolvedPath}: specification exceeds the 5 MiB safety limit.`);
    }

    const extension = extname(resolvedPath).toLowerCase();
    const parsed =
      extension === '.json' ? parseJson(contents, resolvedPath) : parseYaml(contents, resolvedPath);
    return validateOpenApiDocument(parsed, resolvedPath);
  } finally {
    await handle.close();
  }
}
