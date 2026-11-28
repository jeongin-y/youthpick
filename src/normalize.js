// AI 출력을 판별 코드가 믿을 수 있는 형태로 정리한다.
// 원칙: 코드가 확신할 수 없는 조건은 버리지 않고 field="other"(❓)로 내린다.

import { STATUS_VALUES, HOUSEHOLD_VALUES } from './schema.js';

const REGION_ALIASES = {
  서울: ['서울특별시', '서울시'],
  부산: ['부산광역시', '부산시'],
  대구: ['대구광역시', '대구시'],
  인천: ['인천광역시', '인천시'],
  광주: ['광주광역시', '광주시'],
  대전: ['대전광역시', '대전시'],
  울산: ['울산광역시', '울산시'],
  세종: ['세종특별자치시', '세종시'],
  경기: ['경기도'],
  강원: ['강원특별자치도', '강원도'],
  충북: ['충청북도'],
  충남: ['충청남도'],
  전북: ['전북특별자치도', '전라북도'],
  전남: ['전라남도'],
  경북: ['경상북도'],
  경남: ['경상남도'],
  제주: ['제주특별자치도', '제주도'],
  전국: ['대한민국', '전 국민'],
};
const REGION_LOOKUP = new Map(
  Object.entries(REGION_ALIASES).flatMap(([short, longs]) => [[short, short], ...longs.map((l) => [l, short])]),
);

export function normalizeRegion(name) {
  if (name == null) return name;
  const t = String(name).trim();
  return REGION_LOOKUP.get(t) ?? t;
}

const ALLOWED_VALUES = { status: STATUS_VALUES, household: HOUSEHOLD_VALUES };

// 연소득 상한이 이 값보다 작으면 원 단위 금액이 아니라 비율(중위소득 % 등)을 잘못 넣은 것으로 본다.
const MIN_PLAUSIBLE_INCOME = 1_000_000;

function toOther(c, note) {
  return { ...c, field: 'other', op: 'text', min: null, max: null, values: null, normalizeNote: note };
}

export function normalizeCondition(c) {
  if (c.field === 'region' && c.values) {
    const values = [...new Set(c.values.map(normalizeRegion))];
    const known = values.every((v) => REGION_LOOKUP.has(v));
    return known ? { ...c, values } : toOther(c, `알 수 없는 지역 값: ${values.join(', ')}`);
  }

  if (ALLOWED_VALUES[c.field]) {
    if (c.op !== 'in' && c.op !== 'not_in') return toOther(c, `${c.field} 조건 형식이 아님`);
    const allowed = ALLOWED_VALUES[c.field];
    const bad = (c.values ?? []).filter((v) => !allowed.includes(v));
    if (bad.length || !c.values?.length) return toOther(c, `허용되지 않은 값: ${bad.join(', ') || '(없음)'}`);
    return c;
  }

  if ((c.field === 'income' || c.field === 'age') && c.op === 'range' && c.min == null && c.max == null) {
    return toOther(c, '범위 조건인데 경계값이 없음');
  }

  if (c.field === 'income') {
    const amounts = [c.min, c.max].filter((v) => v != null && v > 0);
    if (c.op !== 'range' || amounts.some((v) => v < MIN_PLAUSIBLE_INCOME)) {
      return toOther(c, '소득 기준이 원 단위 금액이 아님 (중위소득 % 등)');
    }
  }

  if (c.field === 'age' && c.op !== 'range') return toOther(c, '나이 조건 형식이 아님');

  return c;
}

export function normalizeBenefit(b) {
  const amount = { ...b.amount };
  // 기여금형은 matchRate로 계산하므로 monthly에 상한액을 중복으로 넣은 경우를 비운다
  if (b.benefitType === 'contribution') {
    amount.monthly = null;
    amount.lumpSum = null;
  }
  return { ...b, amount, conditions: b.conditions.map(normalizeCondition) };
}
