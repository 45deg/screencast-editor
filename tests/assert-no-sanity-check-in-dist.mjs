import fs from 'node:fs';
import path from 'node:path';

const distRoot = path.resolve(process.cwd(), 'dist');
const sanityEntry = path.join(distRoot, 'sanity-check.html');

if (!fs.existsSync(distRoot)) {
  throw new Error(`Expected build output at ${distRoot}`);
}

if (fs.existsSync(sanityEntry)) {
  throw new Error('sanity-check.html must not be included in the production build output.');
}

console.log('Verified production build excludes sanity-check.html');
