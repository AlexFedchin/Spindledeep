// Every route check at once (they are separate processes, side by side), each one's output in <folder>/<name>.txt, and a short
// summary. Compare two folders by eye or with diff.    node scripts/checks/all.mjs <folder> [names...]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), [out = path.join(here, '.cache', 'checks'), ...only] = process.argv.slice(2);
const LIST = { lip: [], gal: [], reach: [], shelfrun: [], fuzz: [], hands: [], rooms: [], play1: ['plain', '1'], play2: ['plain', '2'], frayed1: ['frayed', '1'] };
mkdirSync(out, { recursive: true });
await Promise.all(Object.entries(LIST).filter(([n]) => !only.length || only.includes(n)).map(([n, a]) => new Promise((done) => {
  const file = path.join(here, (n.startsWith('play') || n.startsWith('frayed') ? 'play' : n) + '.mjs'), t = Date.now();
  const p = spawn(process.execPath, ['--no-warnings', '--experimental-default-type=module', file, ...a], { windowsHide: true });
  let s = '';
  p.stdout.on('data', (d) => (s += d)); p.stderr.on('data', (d) => (s += d));
  p.on('close', (c) => {
    writeFileSync(path.join(out, n + '.txt'), s + `exit ${c}\n`);
    const last = s.trim().split('\n');
    console.log(`${n.padEnd(8)} exit ${c}  ${((Date.now() - t) / 1000).toFixed(0)} s  ${last[Math.max(0, last.length - (n.startsWith('p') || n === 'frayed1' ? 2 : 1))]?.slice(0, 150)}`);
    done();
  });
})));
