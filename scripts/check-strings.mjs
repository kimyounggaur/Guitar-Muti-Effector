// Fails when a component shows English text the user reads (design §3.7, U8).
// Checked: JSX text, the aria-label / title / placeholder / alt attributes and window.confirm / alert
// arguments in the TSX files of src/components, src/app and src/App.tsx. A text passes when it holds Korean, or when every
// Latin word in it is on ALLOWED_ENGLISH (src/i18n/ko.ts) or on PANEL_LETTERING below.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const root = new URL('..', import.meta.url).pathname;
const koSource = readFileSync(join(root, 'src/i18n/ko.ts'), 'utf8');
const allowedBlock = koSource.match(/ALLOWED_ENGLISH = \[([\s\S]*?)\]/)?.[1] ?? '';
const allowed = new Set([...allowedBlock.matchAll(/'([^']+)'/g)].map((match) => match[1].toLowerCase()));

// Lettering printed on the hardware panels, kept as it is on purpose.
const PANEL_LETTERING = [
  'STROBE', 'TUNER', 'NOISE', 'REDUCER', 'GATE', 'COMP', 'DRIVE', 'TUN', 'DRV', 'CAB', 'MOD', 'DLY', 'REV', 'LOOP', 'RHY',
  'VOLUME', 'MASTER', 'BANK', 'PATCH', 'REC', 'PLAY', 'DUB', 'STOP', 'CLEAR', 'UNDO', 'MODE', 'PRE', 'MODEL', 'CH',
  'INPUT', 'OUTPUT', 'LEVEL', 'THRESHOLD', 'RELEASE', 'ATTACK', 'SUSTAIN', 'TONE', 'GAIN', 'BASS', 'MID', 'TREBLE',
  'PRESENCE', 'MIX', 'CENTS', 'NOTE', 'CAL', 'REF', 'SENS', 'HOLD', 'RATIO', 'KNEE', 'FX', 'USER', 'FACTORY', 'NEW',
  'SYNC', 'BAR', 'BARS', 'BEAT', 'TEMPO', 'SET', 'LOW', 'HIGH', 'CUT',
  // The app's name (U9) on the left badge.
  'GUITAR', 'MULTI', 'EFFECTOR', 'TOUCH', 'PROCESSOR',
].map((word) => word.toLowerCase());
for (const word of PANEL_LETTERING) allowed.add(word);

const checkedAttributes = new Set(['aria-label', 'title', 'placeholder', 'alt']);
const checkedCalls = new Set(['confirm', 'alert']);

const files = [join(root, 'src/App.tsx'), ...walk(join(root, 'src/components')), ...walk(join(root, 'src/app'))];
const problems = [];

for (const file of files) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const report = (node, text) => {
    if (passes(text)) return;
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
    problems.push(`${relative(root, file)}:${line + 1}  ${JSON.stringify(text.trim())}`);
  };
  const visit = (node) => {
    if (ts.isJsxText(node)) report(node, node.text);
    if (ts.isJsxAttribute(node) && checkedAttributes.has(node.name.getText(source)) && node.initializer) {
      for (const text of literalTexts(node.initializer)) report(node, text);
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(source).replace(/^window\./, '');
      if (checkedCalls.has(callee) && node.arguments[0]) for (const text of literalTexts(node.arguments[0])) report(node, text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

if (problems.length) {
  console.error(`check-strings: ${problems.length} English text(s) the user would see. Move them to src/i18n/ko.ts:`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log(`check-strings: ${files.length} files, no untranslated text.`);

function passes(text) {
  if (/[가-힣]/.test(text)) return true;
  const words = text.match(/[A-Za-z]{2,}/g) ?? [];
  return words.every((word) => allowed.has(word.toLowerCase()));
}

function literalTexts(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  if (ts.isJsxExpression(node)) return node.expression ? literalTexts(node.expression) : [];
  if (ts.isTemplateExpression(node)) return [[node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(' ')];
  if (ts.isConditionalExpression(node)) return [...literalTexts(node.whenTrue), ...literalTexts(node.whenFalse)];
  if (ts.isParenthesizedExpression(node)) return literalTexts(node.expression);
  return [];
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx$/.test(name) ? [path] : [];
  });
}
