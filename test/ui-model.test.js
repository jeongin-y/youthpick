import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { judgeCondition, MET, UNMET, UNKNOWN } from '../src/eligibility.js';
import {
  PERSONA_A, buildProfile, judgeAll, manToWon, periodStatus, plan, sourceLink,
} from '../src/ui/model.js';

const load = (file) => JSON.parse(readFileSync(file, 'utf8')).benefits;

function planFor(input, off = new Set()) {
  const judged = judgeAll(load('data/benefits.sample.json'), buildProfile(input));
  return plan({ goal: manToWon(input.goal), monthlySaving: manToWon(input.saving), judged, off });
}

test('화면의 페르소나 A는 demo와 같은 숫자: 50개월 → 36개월', () => {
  const r = planFor(PERSONA_A);
  assert.equal(r.base.months, 50);
  assert.equal(r.withBenefits.months, 36);
  assert.equal(r.savedMonths, 14);
});

test('혜택을 모두 끄면 기본 도달 시점과 같다', () => {
  const r = planFor(PERSONA_A, new Set(['sample-rent', 'sample-savings']));
  assert.equal(r.withBenefits.months, r.base.months);
});

test('소득 구간: 전부 기준 안이면 ✅, 밖이면 ❌, 걸치면 ❓', () => {
  const cond = { field: 'income', op: 'range', min: null, max: 30_000_000 };
  const status = (income) => judgeCondition(cond, buildProfile({ income })).status;
  assert.equal(status('b2'), MET);
  assert.equal(status('b3'), UNKNOWN);
  assert.equal(status('b4'), UNMET);
  assert.equal(status(''), UNKNOWN);
});

test('빈 입력은 null, 만원 입력은 원 단위', () => {
  assert.equal(buildProfile({ age: '', region: '', household: '' }).age, null);
  assert.equal(manToWon('1,000'), 10_000_000);
  assert.equal(manToWon('abc'), null);
  assert.equal(manToWon(''), null);
});

test('모집 마감 여부', () => {
  const period = { start: '2026-10-07', end: '2026-10-16', always: false };
  assert.equal(periodStatus(period, new Date(2026, 9, 16)).closed, false);
  assert.equal(periodStatus(period, new Date(2026, 9, 17)).closed, true);
});

test('원문 링크는 http(s) 또는 data/raw 파일만', () => {
  assert.equal(sourceLink({ applyUrl: 'javascript:alert(1)' }), null);
  assert.equal(sourceLink({ sourceFile: 'data/raw/../../.env' }), null);
  assert.equal(sourceLink({ sourceFile: 'data/raw/sample-rent.txt' }), 'data/raw/sample-rent.txt');
});
