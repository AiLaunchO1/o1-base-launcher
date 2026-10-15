import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { stripTypeScriptTypes } from 'node:module';

async function build(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const source = join(directory, entry.name);
    if (entry.isDirectory()) { await build(source); continue; }
    if (!entry.name.endsWith('.ts')) continue;
    const target = source.replace(/^src[\\/]/, 'dist/').replace(/\.ts$/, '.js');
    await mkdir(dirname(target), { recursive: true });
    const text = await readFile(source, 'utf8');
    const js = stripTypeScriptTypes(text).replace(/(from\s+['"]\.?[^'"]+)\.ts(['"])/g, '$1.js$2');
    await writeFile(target, js);
  }
}
await build('src');
