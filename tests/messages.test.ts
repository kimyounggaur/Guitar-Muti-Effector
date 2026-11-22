// P6d: every on-screen label comes from src/i18n/ko.ts, and every error reaches the user as Korean text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PEDAL_SCHEMAS } from '../src/audio/params/schema';
import { AudioEngineError, cancelled, type AudioEngineErrorCode } from '../src/audio/errors';
import { toUserMessage } from '../src/app/userMessage';
import { ko, t, tDynamic } from '../src/i18n/ko';

const hangul = /[가-힣]/;

test('every schema label has a Korean entry', () => {
  for (const [type, params] of Object.entries(PEDAL_SCHEMAS)) {
    for (const [name, spec] of Object.entries(params)) {
      assert.equal(spec.label, `param.${type}.${name}`);
      assert.ok(spec.label in ko, `${spec.label} missing from ko.ts`);
      assert.match(ko[spec.label as keyof typeof ko], hangul, `${spec.label} is not Korean`);
    }
  }
});

test('every pedal type has a Korean name and a short name', () => {
  for (const type of Object.keys(PEDAL_SCHEMAS)) {
    assert.match(tDynamic(`pedal.${type}.name`, ''), hangul, `pedal.${type}.name`);
    assert.ok(tDynamic(`pedal.${type}.short`, '').length > 0, `pedal.${type}.short`);
  }
});

test('t replaces placeholders and leaves unknown ones', () => {
  assert.equal(t('confirm.deletePreset', { name: '클린' }), '프리셋 "클린"을 삭제하시겠습니까?');
  assert.equal(t('input.deviceN', {}), '입력 장치 {n}');
  assert.equal(tDynamic('param.nothing.here', 'fallback'), 'fallback');
});

test('engine error codes map to their own message', () => {
  const codes: AudioEngineErrorCode[] = ['engineNotReady', 'contextClosed', 'outputNotSupported', 'connectionCancelled', 'rebuildFailed', 'unsupportedBrowser'];
  for (const code of codes) assert.equal(toUserMessage(new AudioEngineError(code)), ko[`error.${code}`]);
});

test('connectionCancelled keeps the AbortError name the controller checks', () => {
  const error = cancelled();
  assert.equal(error.name, 'AbortError');
  assert.equal(toUserMessage(error), ko['error.connectionCancelled']);
});

test('browser errors map to their messages', () => {
  const cases: Array<[string, keyof typeof ko]> = [
    ['NotAllowedError', 'error.permission'],
    ['SecurityError', 'error.permission'],
    ['NotFoundError', 'error.noInputDevice'],
    ['NotReadableError', 'error.deviceBusy'],
    ['OverconstrainedError', 'error.deviceGone'],
    ['AbortError', 'error.connectionCancelled'],
  ];
  for (const [name, key] of cases) {
    const error = new Error('browser detail');
    error.name = name;
    assert.equal(toUserMessage(error), ko[key], name);
  }
});

test('anything else becomes the general message and is logged', () => {
  const original = console.error;
  const logged: unknown[] = [];
  console.error = (value: unknown) => logged.push(value);
  try {
    const error = new Error('Could not do it');
    assert.equal(toUserMessage(error), ko['error.unknown']);
    assert.equal(toUserMessage('text'), ko['error.unknown']);
    assert.deepEqual(logged, [error, 'text']);
  } finally {
    console.error = original;
  }
});

test('error messages are Korean', () => {
  for (const [key, value] of Object.entries(ko)) if (key.startsWith('error.')) assert.match(value, hangul, key);
});
