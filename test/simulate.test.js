import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { simulate, compare } from '../src/simulate.js';

const { benefits } = JSON.parse(readFileSync('data/benefits.sample.json', 'utf8'));
const get = (id) => benefits.find((b) => b.id === id);

test('혜택 없이: 목표 ÷ 월 저축액 (올림)', () => {
  assert.equal(simulate({ goal: 10_000_000, monthlySaving: 200_000 }).months, 50);
  assert.equal(simulate({ goal: 20_000_000, monthlySaving: 300_000 }).months, 67); // 제안서 예시
});

test('저축 0원이면 도달 못 함', () => {
  assert.equal(simulate({ goal: 1_000_000, monthlySaving: 0 }).months, null);
});

test('지출감소형: 월 20만원 × 12개월이 저축에 더해진다', () => {
  // 12개월 뒤 480만원, 이후 월 20만원 → 26개월 더 = 38
  assert.equal(simulate({ goal: 10_000_000, monthlySaving: 200_000, benefits: [get('sample-rent')] }).months, 38);
});

test('기여금형: 만기(36개월) 달에 한 번에 들어온다', () => {
  const r = simulate({ goal: 10_000_000, monthlySaving: 200_000, benefits: [get('sample-savings')] });
  assert.equal(r.timeline[34], 7_000_000); // 35개월째: 기여금 아직 없음
  assert.equal(r.timeline[35], 7_200_000 + 432_000); // 36개월째: 1.2만원 × 36
  assert.equal(r.months, 48);
});

test('기여금은 월 상한(3만원)을 넘지 않는다', () => {
  const r = simulate({ goal: 1e12, monthlySaving: 1_000_000, benefits: [get('sample-savings')], maxMonths: 36 });
  assert.equal(r.timeline[35], 36_000_000 + 30_000 * 36);
});

test('compare: 혜택별 단축 개월 + 합산', () => {
  const r = compare({ goal: 10_000_000, monthlySaving: 200_000, benefits: [get('sample-rent'), get('sample-savings')] });
  assert.equal(r.baseMonths, 50);
  assert.deepEqual(r.each.map((e) => [e.id, e.savedMonths]), [['sample-rent', 12], ['sample-savings', 2]]);
  assert.deepEqual(r.combined, { months: 36, savedMonths: 14 });
});
