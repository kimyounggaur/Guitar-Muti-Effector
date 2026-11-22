// Runs the recording specs and writes tests/e2e/baseline.json from their JSON attachments.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const run = spawnSync('npx', ['playwright', 'test', 'tests/e2e/layout.spec.ts', 'tests/e2e/presets.spec.ts', '--reporter=json'], {
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024,
  shell: process.platform === 'win32',
});
if (run.status !== 0) {
  process.stderr.write(run.stderr);
  process.stderr.write(run.stdout.slice(-4000));
  process.exit(run.status ?? 1);
}
const report = JSON.parse(run.stdout);
const baseline = { recordedAt: new Date().toISOString(), layout: {}, presets: [] };
const visit = (suite) => {
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests) {
      for (const result of t.results) {
        for (const attachment of result.attachments ?? []) {
          if (!attachment.body) continue;
          const data = JSON.parse(Buffer.from(attachment.body, 'base64').toString('utf8'));
          if (attachment.name === 'layout.json') baseline.layout[data.project] = data;
          if (attachment.name === 'presets.json') baseline.presets = data;
        }
      }
    }
  }
  (suite.suites ?? []).forEach(visit);
};
report.suites.forEach(visit);
writeFileSync('tests/e2e/baseline.json', `${JSON.stringify(baseline, null, 2)}\n`);
console.log(`baseline: ${Object.keys(baseline.layout).length} layouts, ${baseline.presets.length} presets`);
