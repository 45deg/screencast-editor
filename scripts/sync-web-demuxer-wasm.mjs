import { mkdir, copyFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const packageEntryPath = require.resolve('web-demuxer');
const packageRoot = dirname(dirname(packageEntryPath));
const wasmFiles = ['web-demuxer.wasm'];
const destinationRoot = fileURLToPath(new URL('../public/', import.meta.url));

await mkdir(destinationRoot, { recursive: true });

for (const wasmFileName of wasmFiles) {
  const sourcePath = join(packageRoot, 'dist', 'wasm-files', wasmFileName);
  const destinationPath = join(destinationRoot, wasmFileName);

  await copyFile(sourcePath, destinationPath);
}

console.log(`Copied web-demuxer wasm files to ${destinationRoot}`);