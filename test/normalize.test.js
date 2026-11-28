import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCondition, normalizeBenefit, normalizeRegion } from '../src/normalize.js';
import { judgeCondition, MET } from '../src/eligibility.js';

// 아래 입력들은 gpt-4o-mini 첫 실행에서 실제로 나온 출력이다.

test('지역 정식 명칭 → 짧은 이름', () => {
  assert.equal(normalizeRegion('서울특별시'), '서울');
  assert.equal(normalizeRegion('전라북도'), '전북');
  const c = normalizeCondition({ field: 'region', op: 'in', values: ['서울특별시'], label: '거주지' });
  assert.deepEqual(c.values, ['서울']);
});

test('판별 시에도 지역 표기 차이를 흡수한다', () => {
  const c = { field: 'region', op: 'in', values: ['서울특별시'] };
  assert.equal(judgeCondition(c, { region: '서울' }).status, MET);
});

test('중위소득 150%를 income ≤ 1.5원으로 넣은 경우 → other(❓)', () => {
  const c = normalizeCondition({ field: 'income', op: 'range', min: 0, max: 1.5, values: null, label: '소득' });
  assert.equal(c.field, 'other');
  assert.match(c.normalizeNote, /원 단위/);
});

test('경계값 없는 소득 범위(중위소득 150%) → other(❓)', () => {
  const c = normalizeCondition({ field: 'income', op: 'range', min: null, max: null, values: null, label: '가구 중위소득 150% 이하' });
  assert.equal(c.field, 'other');
});

test('소제목을 붙인 근거 문장도 줄마다 원문에 있으면 인정', async () => {
  const { verifyEvidence } = await import('../src/evidence.js');
  const src = '가입 대상\n만 19세 이상 34세 이하 청년\n개인 연소득 6,000만원 이하';
  const b = verifyEvidence({ conditions: [
    { evidence: '가입 대상\n개인 연소득 6,000만원 이하' },
    { evidence: '가입 대상\n개인 연소득 9,000만원 이하' },
  ] }, src);
  assert.deepEqual(b.conditions.map((c) => c.evidenceVerified), [true, false]);
});

test('정상 연소득 조건은 그대로', () => {
  const c = { field: 'income', op: 'range', min: 0, max: 36_000_000, values: null, label: '소득' };
  assert.deepEqual(normalizeCondition(c), c);
});

test('허용되지 않은 신분 값(enrolled) → other(❓)', () => {
  const c = normalizeCondition({ field: 'status', op: 'not_in', values: ['student', 'enrolled'], label: '신분' });
  assert.equal(c.field, 'other');
});

test('기여금형의 monthly는 비운다', () => {
  const b = normalizeBenefit({
    benefitType: 'contribution',
    amount: { monthly: 30000, matchRate: 0.06, matchCapMonthly: 30000, durationMonths: 36 },
    conditions: [],
  });
  assert.equal(b.amount.monthly, null);
});
