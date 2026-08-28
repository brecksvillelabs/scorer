import { cp, mkdir, readdir, rm, copyFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');
const allowed = new Set(['.html', '.js', '.css', '.webmanifest']);

await rm(dist, { recursive:true, force:true });
await mkdir(dist, { recursive:true });

for (const entry of await readdir(root, { withFileTypes:true })) {
  if (entry.isFile() && allowed.has(extname(entry.name))) {
    await copyFile(join(root, entry.name), join(dist, entry.name));
  }
}
await cp(join(root, 'assets'), join(dist, 'assets'), { recursive:true });

await writeFile(join(dist, 'native-build.json'), JSON.stringify({
  version:'0.4.1',
  builtAt:new Date().toISOString(),
  source:'Scorer web core'
}, null, 2));

console.log('Prepared Scorer web assets for Capacitor in dist/');
