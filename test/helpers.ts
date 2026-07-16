import { join } from 'node:path';

export function fixturePath(name: string): string {
  return join(import.meta.dirname, 'fixtures', name);
}

export function examplePath(name: string): string {
  return join(import.meta.dirname, '..', 'examples', name);
}
