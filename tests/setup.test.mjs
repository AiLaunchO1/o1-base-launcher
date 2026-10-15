import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { installToHome } from '../scripts/setup.mjs';

test('setup installs for all clients and preserves unrelated config', async () => {
  const home = await mkdtemp(join(tmpdir(), 'o1-setup-test-'));
  const oldKey = process.env.O1_API_KEY;
  try {
    await mkdir(join(home, '.codex'), { recursive: true });
    await mkdir(join(home, '.cursor'), { recursive: true });
    await writeFile(join(home, '.codex', 'config.toml'), 'model = "example"\n');
    await writeFile(join(home, '.cursor', 'mcp.json'), JSON.stringify({ mcpServers: { existing: { command: 'other' } } }));
    await writeFile(join(home, '.claude.json'), JSON.stringify({ theme: 'dark' }));
    process.env.O1_API_KEY = 'test-secret-do-not-copy';

    await installToHome(home, new Set(['codex', 'claude', 'cursor']));
    await installToHome(home, new Set(['codex', 'claude', 'cursor']));

    const codex = await readFile(join(home, '.codex', 'config.toml'), 'utf8');
    const cursor = JSON.parse(await readFile(join(home, '.cursor', 'mcp.json'), 'utf8'));
    const claude = JSON.parse(await readFile(join(home, '.claude.json'), 'utf8'));
    assert.match(codex, /model = "example"/);
    assert.equal((codex.match(/\[mcp_servers\.o1-base-launcher\]/g) ?? []).length, 1);
    assert.equal(cursor.mcpServers.existing.command, 'other');
    assert.equal(cursor.mcpServers['o1-base-launcher'].type, 'stdio');
    assert.equal(claude.theme, 'dark');
    assert.equal(claude.mcpServers['o1-base-launcher'].type, 'stdio');
    assert.match(await readFile(join(home, '.agents', 'skills', 'o1-base-launcher', 'SKILL.md'), 'utf8'), /name: o1-base-launcher/);
    assert.match(await readFile(join(home, '.claude', 'skills', 'o1-base-launcher', 'SKILL.md'), 'utf8'), /name: o1-base-launcher/);
    assert.ok(![codex, JSON.stringify(cursor), JSON.stringify(claude)].join('').includes(process.env.O1_API_KEY));
  } finally {
    if (oldKey === undefined) delete process.env.O1_API_KEY;
    else process.env.O1_API_KEY = oldKey;
    const prefix = resolve(tmpdir()) + sep;
    assert.ok(resolve(home).startsWith(prefix));
    await rm(home, { recursive: true, force: true });
  }
});
