import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
function files(dir) { return readdir(dir, { withFileTypes: true }).then(async entries => (await Promise.all(entries.map(async e => e.isDirectory() ? files(join(dir,e.name)) : [join(dir,e.name)]))).flat()); }
for (const file of (await files('dist')).filter(f => f.endsWith('.js'))) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
