import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const base = 'public/games/exam-prep/';
const html = readFileSync(base + 'index.html', 'utf8');
const breakScript = readFileSync(base + 'break-games.js', 'utf8');
const unified = readFileSync(base + 'unified.js', 'utf8');
const navigation = readFileSync(base + 'navigation.js', 'utf8');

test('ExamPro inline and external scripts parse', () => {
  const inline = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  assert.ok(inline.length >= 5);
  inline.forEach(([_, source]) => new vm.Script(source));
  [breakScript, unified, navigation, readFileSync(base + 'bank.js', 'utf8')].forEach((source) => new vm.Script(source));
});
test('all local game destinations exist', () => {
  const urls = [...breakScript.matchAll(/url:'([^']+)'/g)].map((m) => m[1]);
  assert.equal(urls.length, 7);
  for (const url of urls) {
    assert.ok(url.startsWith('/'), url);
    if (url.startsWith('/games/')) assert.ok(existsSync('public' + url + 'index.html'), url);
  }
});
test('Afro Zone games launch from ExamPro without opening the old catalog', () => {
  assert.match(breakScript, /game=gebeta&from=exampro/);
  assert.match(breakScript, /game=checkers&from=exampro/);
  assert.match(breakScript, /game=bingo&from=exampro/);
  const gameApp = readFileSync('src/components/GebetaApp.jsx', 'utf8');
  assert.match(gameApp, /get\('from'\) === 'exampro'/);
  assert.match(gameApp, /setView\(\{ name: 'modes' \}\)/);
});
test('game player remains inside ExamPro and can return to exam', () => {
  assert.match(breakScript, /document\.createElement\('iframe'\)/);
  assert.match(breakScript, /Return to ExamPro/);
  assert.match(breakScript, /Your timed exam keeps counting down/);
  assert.doesNotMatch(breakScript, /target="_blank"/);
});
test('same-origin frame exception is limited to game breaks', () => {
  const config = readFileSync('next.config.mjs', 'utf8');
  assert.match(config, /frame-ancestors 'none'/);
  assert.match(config, /source: '\/break'/);
  assert.match(config, /frame-ancestors 'self'/);
  assert.match(config, /SAMEORIGIN/);
});
test('daily goal and legacy progress migration are wired', () => {
  assert.match(html, /function dailyGoal\(\)/);
  assert.match(html, /p\.today \/ dailyGoal\(\)/);
  assert.match(html, /examprep\.progress\.v1/);
  assert.match(unified, /exampro\.plan\.settings\.v1/);
});
test('companion screens and navigation are wired', () => {
  for (const file of ['unified.js', 'break-games.js', 'navigation.js']) {
    assert.ok(html.includes('src="' + file + '"'), file);
  }
  assert.match(unified, /ep-panel-open/);
  assert.match(navigation, /ep-nav-sheet/);
});

test('saved learner grade scopes home, subjects, and recommended practice', () => {
  assert.match(html, /function learnerBank\(\)/);
  assert.match(html, /function learnerCategories\(\)/);
  assert.match(html, /learnerCategories\(\)\.slice\(\)/);
  assert.match(html, /var list = learnerBank\(\)\.filter/);
  assert.match(html, /var pool = learnerBank\(\)\.filter/);
  assert.match(unified, /id="ep-profile-stage"/);
  assert.match(unified, /stage:stage/);
});
test('Grade 1 practice exists and is loaded before the main exam script', () => {
  const primary = readFileSync(base + 'primary-bank.js', 'utf8');
  new vm.Script(primary);
  assert.match(primary, /grade-1-foundations/);
  assert.match(primary, /"grade":1/);
  assert.ok(html.indexOf('src="primary-bank.js"') > html.indexOf('src="bank.js"'));
  assert.match(html, /Number\(d\.grade\) === Number\(stage\.slice\(1\)\)/);
});
test('ExamPro game break cannot render old catalog even on home navigation', () => {
  const app = readFileSync('src/components/GebetaApp.jsx', 'utf8');
  assert.match(app, /examproBreak \? 'modes' : 'home'/);
  assert.match(app, /if \(examproBreak\) \{ body = <ModesScreen/);
});
