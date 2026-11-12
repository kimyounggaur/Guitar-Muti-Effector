import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = await mkdtemp(join(tmpdir(), 'guitar-tests-'));
try {
  const outfile = join(dir, 'suite.mjs');
  await build({ entryPoints: ['tests/safety.test.ts'], bundle: true, platform: 'node', format: 'esm', outfile,
    plugins: [{ name: 'worker-url-stub', setup(build) {
      build.onResolve({ filter: /\?worker&url$/ }, args => ({ path: args.path, namespace: 'worker-url' }));
      build.onLoad({ filter: /.*/, namespace: 'worker-url' }, () => ({ contents: 'export default "test-worker.js"', loader: 'js' }));
    } }],
  });
  const result = spawnSync(process.execPath, ['--test', outfile], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} finally {
  await rm(dir, { recursive: true, force: true });
}
