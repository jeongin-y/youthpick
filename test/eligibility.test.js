import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { judgeBenefit, judgeCondition, MET, UNMET, UNKNOWN } from '../src/eligibility.js';
import { verifyEvidence } from '../src/evidence.js';

const { benefits } = JSON.parse(readFileSync('data/benefits.sample.json', 'utf8'));
const get = (id) => benefits.find((b) => b.id === id);

const studentA = { age: 21, region: '서울', status: 'student', annualIncome: 7_800_000, independent: true };
const jobseekerB = { age: 25, region: '서울', status: 'jobseeker', annualIncome: 0, independent: false };

test('대학생 A: 월세 지원 eligible', () => {
  assert.equal(judgeBenefit(get('sample-rent'), studentA).overall, 'eligible');
});

test('취준생 B: 부모님과 살아서 월세 지원은 독립 가구 조건 하나만 미충족 → nearMiss', () => {
  const r = judgeBenefit(get('sample-rent'), jobseekerB);
  assert.equal(r.overall, 'ineligible');
  assert.equal(r.nearMiss.label, '독립 가구');
});

test('자동 판별 못 하는 조건은 ❓ → check', () => {
  const r = judgeBenefit(get('sample-savings'), studentA);
  assert.equal(r.overall, 'check');
  assert.equal(r.results.find((c) => c.field === 'other').status, UNKNOWN);
});

test('구직수당: 대학생은 ❌, 취준생은 ❓(중위소득 확인 필요)', () => {
  assert.equal(judgeBenefit(get('sample-jobseeker'), studentA).overall, 'ineligible');
  assert.equal(judgeBenefit(get('sample-jobseeker'), jobseekerB).overall, 'check');
});

test('범위 조건 경계값과 입력 누락', () => {
  const age = { field: 'age', op: 'range', min: 19, max: 34 };
  assert.equal(judgeCondition(age, { age: 34 }).status, MET);
  assert.equal(judgeCondition(age, { age: 35 }).status, UNMET);
  const income = { field: 'income', op: 'range', min: null, max: 36_000_000 };
  assert.equal(judgeCondition(income, { annualIncome: null }).status, UNKNOWN);
});

test('지역 "전국"은 누구나 충족', () => {
  const c = { field: 'region', op: 'in', values: ['전국'] };
  assert.equal(judgeCondition(c, { region: '부산' }).status, MET);
});

test('원문에 없는 근거 문장(AI가 지어낸 것)은 ❓로 강등', () => {
  const source = readFileSync('data/raw/sample-rent.txt', 'utf8');
  const b = structuredClone(get('sample-rent'));
  b.conditions[3].evidence = '본인 연소득 5,000만원 이하'; // 원문과 다름
  verifyEvidence(b, source);
  assert.deepEqual(b.conditions.map((c) => c.evidenceVerified), [true, true, true, false]);
  assert.equal(judgeBenefit(b, studentA).overall, 'check');
});
