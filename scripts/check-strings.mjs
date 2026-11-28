// Keep Korean interface text in the dictionary and reject unapproved English copy (design §3.7, U8).
// Checked: JSX text and direct display expressions, accessibility and control labels, and window.confirm / alert
// arguments in the TSX files of src/components, src/app and src/App.tsx. A literal passes when every
// Latin word in it is on ALLOWED_ENGLISH (src/i18n/ko.ts).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const root = new URL('..', import.meta.url).pathname;
const koSource = readFileSync(join(root, 'src/i18n/ko.ts'), 'utf8');
const allowedBlock = koSource.match(/ALLOWED_ENGLISH = \[([\s\S]*?)\]/)?.[1] ?? '';
const allowed = new Set([...allowedBlock.matchAll(/'([^']+)'/g)].map((match) => match[1].toLowerCase()));

const checkedAttributes = new Set(['aria-label', 'title', 'placeholder', 'alt', 'label', 'targetLabel']);
const checkedCalls = new Set(['confirm', 'alert']);

const files = [join(root, 'src/App.tsx'), ...walk(join(root, 'src/components')), ...walk(join(root, 'src/app'))];
const problems = new Set();

for (const file of files) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const report = (node, text) => {
    if (passes(text)) return;
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
    problems.add(`${relative(root, file)}:${line + 1}  ${JSON.stringify(text.trim())}`);
  };
  const visit = (node) => {
    if ((ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node))
        && /[가-힣]/.test(node.text)) report(node, node.text);
    if (ts.isJsxText(node)) report(node, node.text);
    if (ts.isJsxExpression(node) && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      for (const text of literalTexts(node)) report(node, text);
    }
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

if (problems.size) {
  console.error(`check-strings: ${problems.size} hardcoded interface text(s). Move them to src/i18n/ko.ts:`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log(`check-strings: ${files.length} files, interface strings checked.`);

function passes(text) {
  if (/[가-힣]/.test(text)) return false;
  const words = text.match(/[A-Za-z]{2,}/g) ?? [];
  return words.every((word) => allowed.has(word.toLowerCase()));
}

function literalTexts(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  if (ts.isJsxExpression(node)) return node.expression ? literalTexts(node.expression) : [];
  if (ts.isTemplateExpression(node)) return [[node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(' ')];
  if (ts.isConditionalExpression(node)) return [...literalTexts(node.whenTrue), ...literalTexts(node.whenFalse)];
  if (ts.isBinaryExpression(node)) {
    if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return literalTexts(node.right);
    if ([ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) {
      return [...literalTexts(node.left), ...literalTexts(node.right)];
    }
  }
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
