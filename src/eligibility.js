// 규칙 기반 자격 판별. AI는 조건을 "쪼개기"만 하고, 충족 여부는 여기서 코드로 정한다.

import { normalizeRegion } from './normalize.js';

export const MET = 'met';         // ✅
export const UNMET = 'unmet';     // ❌
export const UNKNOWN = 'unknown'; // ❓

export const STATUS_ICON = { [MET]: '✅', [UNMET]: '❌', [UNKNOWN]: '❓' };

/**
 * @typedef {Object} Profile
 * @property {number} age               만 나이
 * @property {string} region            시·도 짧은 이름 (예: 서울)
 * @property {'student'|'jobseeker'|'employed'} status
 * @property {number|null} [annualIncome] 연소득(원). 모르면 null
 * @property {{min:number,max:number}|null} [incomeRange] 연소득 구간(원). 있으면 annualIncome 대신 쓴다
 * @property {boolean|null} independent 독립 가구 여부
 */

export function judgeCondition(cond, profile) {
  if (cond.evidenceVerified === false) {
    return { status: UNKNOWN, reason: '근거 문장을 원문에서 찾지 못해 확인 필요' };
  }
  switch (cond.field) {
    case 'age':
      return inRange(profile.age, cond);
    case 'income':
      return profile.incomeRange
        ? bandInRange(profile.incomeRange, cond)
        : inRange(profile.annualIncome, cond);
    case 'region':
      return membership(normalizeRegion(profile.region), { ...cond, values: cond.values?.map(normalizeRegion) }, (v) => v === '전국');
    case 'status':
      return membership(profile.status, cond);
    case 'household': {
      const v = profile.independent == null ? null : profile.independent ? 'independent' : 'with_parents';
      return membership(v, cond);
    }
    default:
      return { status: UNKNOWN, reason: '자동 판별할 수 없는 조건' };
  }
}

function inRange(value, cond) {
  if (cond.op !== 'range') return { status: UNKNOWN, reason: '범위 조건 형식이 아님' };
  if (cond.min == null && cond.max == null) return { status: UNKNOWN, reason: '범위 경계값 없음' };
  if (value == null) return { status: UNKNOWN, reason: '입력값 없음' };
  if (cond.min != null && value < cond.min) return { status: UNMET };
  if (cond.max != null && value > cond.max) return { status: UNMET };
  return { status: MET };
}

// 구간 입력: 구간 전체가 기준 안이면 ✅, 전체가 밖이면 ❌, 걸쳐 있으면 ❓
function bandInRange(band, cond) {
  if (cond.op !== 'range') return { status: UNKNOWN, reason: '범위 조건 형식이 아님' };
  if (cond.min == null && cond.max == null) return { status: UNKNOWN, reason: '범위 경계값 없음' };
  const lo = cond.min ?? -Infinity;
  const hi = cond.max ?? Infinity;
  if (band.min >= lo && band.max <= hi) return { status: MET };
  if (band.max < lo || band.min > hi) return { status: UNMET };
  return { status: UNKNOWN, reason: '선택한 소득 구간이 기준에 걸쳐 있어요' };
}

function membership(value, cond, isWildcard = () => false) {
  if (cond.op !== 'in' && cond.op !== 'not_in') return { status: UNKNOWN, reason: '목록 조건 형식이 아님' };
  if (value == null) return { status: UNKNOWN, reason: '입력값 없음' };
  const values = cond.values ?? [];
  const hit = values.includes(value) || values.some(isWildcard);
  const ok = cond.op === 'in' ? hit : !hit;
  return { status: ok ? MET : UNMET };
}

/**
 * 혜택 하나에 대한 판별 결과.
 * overall: eligible(모두 ✅) | check(❓ 있음) | ineligible(❌ 있음)
 * nearMiss: ❌가 딱 하나이고 나머지가 모두 ✅이면 그 조건 (→ "이것만 바꾸면 해당" 안내)
 */
export function judgeBenefit(benefit, profile) {
  const results = benefit.conditions.map((cond) => ({ ...cond, ...judgeCondition(cond, profile) }));
  const unmet = results.filter((r) => r.status === UNMET);
  const unknown = results.filter((r) => r.status === UNKNOWN);
  const overall = unmet.length ? 'ineligible' : unknown.length ? 'check' : 'eligible';
  const nearMiss = unmet.length === 1 && unknown.length === 0 ? unmet[0] : null;
  return { id: benefit.id, title: benefit.title, overall, results, nearMiss };
}
