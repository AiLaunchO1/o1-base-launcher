import { readFile, access } from 'node:fs/promises';
const skill=await readFile('SKILL.md','utf8');
const match=skill.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
if(!match)throw new Error('Missing YAML frontmatter');
if(!/^name:\s*o1-base-launcher\s*$/m.test(match[1]))throw new Error('Invalid skill name');
if(!/^description:\s*\S.+$/m.test(match[1]))throw new Error('Missing skill description');
for(const file of ['references/o1-api.md','references/base-wallet.md'])await access(file);
if(/TODO|\[INSERT|<placeholder>/i.test(skill))throw new Error('Unfinished skill placeholder');
process.stdout.write('Skill metadata and references valid\n');
