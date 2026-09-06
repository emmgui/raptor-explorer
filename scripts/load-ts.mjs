import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';

const cache = new Map();
export async function moduleURL(file) {
  if (cache.has(file)) return cache.get(file);
  let source = await readFile(file, 'utf8');
  const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)];
  for (const match of imports) {
    const spec = match[1];
    const replacement = spec.startsWith('.')
      ? await moduleURL(resolve(dirname(file), spec + '.ts'))
      : import.meta.resolve(spec);
    source = source.replace(match[0], `from ${JSON.stringify(replacement)}`);
  }
  const code = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
  const url =
    'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
  cache.set(file, url);
  return url;
}
