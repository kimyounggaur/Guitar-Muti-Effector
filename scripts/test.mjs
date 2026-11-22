import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = await mkdtemp(join(tmpdir(), 'guitar-tests-'));
try {
  const suites = ['tests/safety.test.ts', 'tests/dsp-measure.test.ts'];
  await build({ entryPoints: suites, bundle: true, platform: 'node', format: 'esm', outdir: dir, outExtension: { '.js': '.mjs' },
    plugins: [{ name: 'worker-url-stub', setup(build) {
      build.onResolve({ filter: /\?worker&url$/ }, args => ({ path: args.path, namespace: 'worker-url' }));
      build.onLoad({ filter: /.*/, namespace: 'worker-url' }, () => ({ contents: 'export default "test-worker.js"', loader: 'js' }));
    } }],
  });
  const files = suites.map((suite) => join(dir, suite.replace(/^tests\//, '').replace(/\.ts$/, '.mjs')));
  const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} finally {
  await rm(dir, { recursive: true, force: true });
}
