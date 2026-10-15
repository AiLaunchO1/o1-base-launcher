import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('..', import.meta.url));
const clients = new Set(['codex', 'claude', 'cursor']);

async function readExisting(path) {
  try { return await readFile(path, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function writeConfig(path, content) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, { encoding: 'utf8', mode: 0o600 });
}

async function installSkill(home, folder) {
  const target = join(home, folder, 'skills', 'o1-base-launcher');
  await mkdir(join(target, 'references'), { recursive: true });
  for (const file of ['SKILL.md', 'README.md']) {
    await copyFile(join(source, file), join(target, file));
  }
  for (const file of await readdir(join(source, 'references'))) {
    await copyFile(join(source, 'references', file), join(target, 'references', file));
  }
  return target;
}

function serverConfig() {
  return { type: 'stdio', command: process.execPath, args: [join(source, 'dist', 'index.js')] };
}

async function installJsonServer(path) {
  const existing = await readExisting(path);
  const data = existing === null ? {} : JSON.parse(existing);
  if (data === null || Array.isArray(data) || typeof data !== 'object') {
    throw new Error(`Expected a JSON object in ${path}`);
  }
  if (data.mcpServers === undefined) data.mcpServers = {};
  if (data.mcpServers === null || Array.isArray(data.mcpServers) || typeof data.mcpServers !== 'object') {
    throw new Error(`Expected mcpServers to be a JSON object in ${path}`);
  }
  data.mcpServers['o1-base-launcher'] = serverConfig();
  await writeConfig(path, JSON.stringify(data, null, 2) + '\n');
}

async function installCodexServer(path) {
  const existing = (await readExisting(path)) ?? '';
  if (/^\[mcp_servers\.(?:"o1-base-launcher"|o1-base-launcher)\]\s*$/m.test(existing)) {
    return 'already configured';
  }
  const config = serverConfig();
  const block = [
    '[mcp_servers.o1-base-launcher]',
    `command = ${JSON.stringify(config.command)}`,
    `args = [${JSON.stringify(config.args[0])}]`,
    'env_vars = ["O1_API_KEY", "BASE_RPC_URL"]',
  ].join('\n');
  await writeConfig(path, existing.replace(/\s*$/, '') + '\n\n' + block + '\n');
  return 'configured';
}

export async function installToHome(home, selected) {
  const result = [];
  if (selected.has('codex') || selected.has('cursor')) {
    result.push(`Skill: ${await installSkill(home, '.agents')}`);
  }
  if (selected.has('claude')) {
    result.push(`Skill: ${await installSkill(home, '.claude')}`);
  }
  if (selected.has('codex')) {
    const path = join(home, '.codex', 'config.toml');
    result.push(`Codex MCP: ${await installCodexServer(path)}`);
  }
  if (selected.has('cursor')) {
    await installJsonServer(join(home, '.cursor', 'mcp.json'));
    result.push('Cursor MCP: configured');
  }
  if (selected.has('claude')) {
    await installJsonServer(join(home, '.claude.json'));
    result.push('Claude Code MCP: configured');
  }
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const choice = args.length === 0 ? 'all' : args[1];
  if ((args.length !== 0 && (args.length !== 2 || args[0] !== '--client')) ||
      !choice || (choice !== 'all' && !clients.has(choice))) {
    throw new Error('Usage: npm run setup -- [--client codex|claude|cursor|all]');
  }
  const selected = choice === 'all' ? clients : new Set([choice]);
  for (const line of await installToHome(homedir(), selected)) console.log(line);
  console.log('Set O1_API_KEY in your own environment, then restart your AI client. No key was written to a config file.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
