import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../', import.meta.url));
process.chdir(root);
mkdirSync('.gaming/runs', { recursive: true });
const dir = mkdtempSync(resolve('.gaming/runs', `${Date.now()}-`));
const gates = [];
for (const [name, args] of [
  ['build', ['run', 'build']],
  ['tests', ['run', 'test']],
  ['botplay', ['exec', 'tsx', 'scripts/harness/botplay.ts', join(dir, 'botplay.json')]],
]) {
  console.log(`Running ${name}…`);
  const started = Date.now();
  const result = spawnSync('pnpm', args, { encoding: 'utf8', timeout: 600_000, maxBuffer: 32 * 1024 * 1024 });
  writeFileSync(join(dir, `${name}.log`), (result.stdout ?? '') + (result.stderr ?? '') + (result.error ? String(result.error) : ''));
  gates.push({ name, pass: result.status === 0 && !result.error, exitCode: result.status, signal: result.signal, durationMs: Date.now() - started });
  console.log(`${gates.at(-1).pass ? 'PASS' : 'FAIL'} ${name}`);
}
const pass = gates.every((gate) => gate.pass);
writeFileSync(join(dir, 'gates.json'), JSON.stringify({ pass, gates, at: new Date().toISOString() }, null, 2) + '\n');
console.log(`Evidence: ${dir}`);
process.exitCode = pass ? 0 : 1;
