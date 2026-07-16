import { SpecError } from '../core/errors.js';
import { asObject, asString, isObject } from '../core/guards.js';
import type { JsonObject, OpenApiDocument } from '../core/types.js';

interface TraversalEntry {
  readonly value: unknown;
  readonly leaving: boolean;
}

function decodePointerSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function resolveLocalPointer(root: JsonObject, reference: string): unknown {
  if (!reference.startsWith('#/')) return undefined;

  return reference
    .slice(2)
    .split('/')
    .map(decodePointerSegment)
    .reduce<unknown>((current, segment) => asObject(current)?.[segment], root);
}

function validateLocalReference(root: JsonObject, reference: string, source: string): void {
  const seen = new Set<string>();
  let currentReference = reference;

  while (true) {
    if (seen.has(currentReference)) {
      throw new SpecError(`${source}: cyclic local $ref chains are not supported.`);
    }
    seen.add(currentReference);

    const target = resolveLocalPointer(root, currentReference);
    if (target === undefined) {
      throw new SpecError(`${source}: could not resolve local $ref '${currentReference}'.`);
    }

    const targetObject = asObject(target);
    const nextReference = targetObject ? asString(targetObject.$ref) : undefined;
    if (!nextReference) return;
    if (!nextReference.startsWith('#/')) {
      throw new SpecError(
        `${source}: external $ref values are not supported in v0.1 (${nextReference}).`,
      );
    }
    currentReference = nextReference;
  }
}

/**
 * Rejects values that would either require I/O to resolve or make a bounded,
 * deterministic walk impossible. An iterative traversal avoids stack growth
 * on untrusted YAML input.
 */
function validateObjectGraph(root: JsonObject, source: string): void {
  const visited = new WeakSet<object>();
  const visiting = new WeakSet<object>();
  const stack: TraversalEntry[] = [{ value: root, leaving: false }];

  while (stack.length > 0) {
    const entry = stack.pop();
    if (!entry || typeof entry.value !== 'object' || entry.value === null) continue;

    const current = entry.value;
    if (entry.leaving) {
      visiting.delete(current);
      visited.add(current);
      continue;
    }

    if (visited.has(current)) continue;
    if (visiting.has(current)) {
      throw new SpecError(`${source}: cyclic YAML aliases are not supported.`);
    }

    if (isObject(current)) {
      const ref = asString(current.$ref);
      if (ref && !ref.startsWith('#/')) {
        throw new SpecError(`${source}: external $ref values are not supported in v0.1 (${ref}).`);
      }
      if (ref) validateLocalReference(root, ref, source);
    }

    visiting.add(current);
    stack.push({ value: current, leaving: true });
    const children = Array.isArray(current) ? current : Object.values(current);
    for (const child of children) {
      stack.push({ value: child, leaving: false });
    }
  }
}

export function validateOpenApiDocument(value: unknown, source: string): OpenApiDocument {
  const document = asObject(value);
  if (!document) {
    throw new SpecError(`${source}: expected the root of the specification to be an object.`);
  }

  const openapi = asString(document.openapi);
  if (!openapi?.startsWith('3.0.')) {
    throw new SpecError(`${source}: only OpenAPI 3.0.x documents are supported in v0.1.`);
  }

  const paths = asObject(document.paths);
  if (!paths) {
    throw new SpecError(`${source}: expected an OpenAPI paths object.`);
  }

  validateObjectGraph(document, source);

  return {
    source,
    raw: document,
    openapi,
    info: asObject(document.info) ?? {},
    paths,
    components: asObject(document.components) ?? {},
  };
}

export function apiIdentity(document: OpenApiDocument) {
  return {
    openapi: document.openapi,
    title: asString(document.info.title) ?? 'Untitled API',
    version: asString(document.info.version) ?? 'unknown',
  };
}

export function schemas(document: OpenApiDocument): JsonObject {
  return asObject(document.components.schemas) ?? {};
}
