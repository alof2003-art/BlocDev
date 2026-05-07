// Renames dist-electron/*.js → *.cjs so Electron loads them as CommonJS
// even when package.json has "type": "module"
import { readdirSync, renameSync } from 'fs';
import { join } from 'path';

const dir = 'dist-electron';

for (const file of readdirSync(dir)) {
  if (file.endsWith('.js')) {
    const from = join(dir, file);
    const to = join(dir, file.replace(/\.js$/, '.cjs'));
    renameSync(from, to);
    console.log(`  renamed: ${file} → ${file.replace(/\.js$/, '.cjs')}`);
  }
}
