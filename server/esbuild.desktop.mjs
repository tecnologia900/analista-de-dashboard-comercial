import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const dir = path.dirname(fileURLToPath(import.meta.url));

await esbuild.build({
  entryPoints: [path.join(dir, 'src/index.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: path.join(dir, 'dist/app.mjs'),
  alias: {
    '@dash/shared': path.join(dir, '../shared/src/index.ts'),
  },
  banner: {
    js: "import { createRequire as __criarRequire } from 'node:module'; const require = __criarRequire(import.meta.url);",
  },
});
