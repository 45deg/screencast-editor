import fs from 'node:fs';
import path from 'node:path';

const outputRoot = path.resolve(process.cwd(), 'screencast-editor');
const sanityEntry = path.join(outputRoot, 'sanity-check.html');

if (!fs.existsSync(outputRoot)) {
  throw new Error(`Expected build output at ${outputRoot}`);
}

if (fs.existsSync(sanityEntry)) {
  throw new Error('sanity-check.html must not be included in the production build output.');
}

console.log('Verified production build excludes sanity-check.html');
