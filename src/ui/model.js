// 화면에서 쓰는 순수 함수 모음. DOM을 건드리지 않아서 node --test로 확인할 수 있다.

import { judgeBenefit } from '../eligibility.js';
import { compare, simulate } from '../simulate.js';

const MAN = 10_000;

// 소득은 정확한 금액 대신 구간으로 받는다 (제안서의 개인정보 최소 수집).
export const INCOME_BANDS = [
  { id: 'none', label: '소득 없음', min: 0, max: 0 },
  { id: 'b1', label: '1,200만원 이하', min: 1, max: 1200 * MAN },
  { id: 'b2', label: '1,200만 초과 ~ 2,400만원', min: 1200 * MAN + 1, max: 2400 * MAN },
  { id: 'b3', label: '2,400만 초과 ~ 3,600만원', min: 2400 * MAN + 1, max: 3600 * MAN },
  { id: 'b4', label: '3,600만 초과 ~ 4,800만원', min: 3600 * MAN + 1, max: 4800 * MAN },
  { id: 'b5', label: '4,800만 초과 ~ 6,000만원', min: 4800 * MAN + 1, max: 6000 * MAN },
  { id: 'b6', label: '6,000만 초과 ~ 7,500만원', min: 6000 * MAN + 1, max: 7500 * MAN },
  { id: 'b7', label: '7,500만원 초과', min: 7500 * MAN + 1, max: Infinity },
];

export const PERSONA_A = {
  goal: '1000', saving: '20', age: '21', region: '서울', status: 'student', income: 'b1', household: 'yes',
};

/** 폼의 문자열 값을 판별 코드가 쓰는 프로필로 바꾼다. 비어 있으면 null(❓). */
export function buildProfile({ age, region, status, income, household }) {
  const band = INCOME_BANDS.find((b) => b.id === income);
  return {
    age: age === '' || age == null ? null : Number(age),
    region: region || null,
    status: status || null,
    annualIncome: null,
    incomeRange: band ? { min: band.min, max: band.max } : null,
    independent: household === 'yes' ? true : household === 'no' ? false : null,
  };
}

/** 만원 단위 입력 문자열 → 원. 잘못된 값이면 null */
export function manToWon(text) {
  const t = String(text ?? '').replace(/,/g, '').trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * MAN) : null;
}

export function formatWon(won) {
  return `${(Math.round(won / 1000) / 10).toLocaleString('ko-KR')}만원`;
}

/** months개월 뒤의 연·월 */
export function arrivalLabel(months, today = new Date()) {
  const d = new Date(today.getFullYear(), today.getMonth() + months, 1);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

const ORDER = { eligible: 0, check: 1, ineligible: 2 };

/** 혜택마다 판별 결과를 붙여서 받을 수 있는 것부터 정렬 */
export function judgeAll(benefits, profile) {
  return benefits
    .map((benefit) => ({ benefit, judge: judgeBenefit(benefit, profile) }))
    .sort((a, b) => ORDER[a.judge.overall] - ORDER[b.judge.overall]);
}

/**
 * 미충족(❌) 혜택은 계산에서 빼고, 사용자가 끈 혜택(off)도 합산에서 뺀다.
 * @param {{goal:number, monthlySaving:number, judged:Array, off:Set<string>}} input
 */
export function plan({ goal, monthlySaving, judged, off }) {
  const usable = judged.filter((j) => j.judge.overall !== 'ineligible').map((j) => j.benefit);
  const selected = usable.filter((b) => !off.has(b.id));
  const { baseMonths, each, assumptions } = compare({ goal, monthlySaving, benefits: usable });
  const base = simulate({ goal, monthlySaving });
  const withBenefits = simulate({ goal, monthlySaving, benefits: selected });
  const savedMonths =
    baseMonths != null && withBenefits.months != null ? baseMonths - withBenefits.months : null;
  return { usable, selected, each, assumptions, base, withBenefits, savedMonths };
}

export function amountLabel({ benefitType, amount: a }) {
  const parts = [];
  if (benefitType === 'contribution') {
    if (a.matchRate != null) parts.push(`납입액의 ${Math.round(a.matchRate * 1000) / 10}% 기여금`);
    if (a.matchCapMonthly != null) parts.push(`월 최대 ${formatWon(a.matchCapMonthly)}`);
  } else {
    if (a.monthly) parts.push(`월 ${formatWon(a.monthly)} ${benefitType === 'cash' ? '지급' : '지출 감소'}`);
    if (benefitType === 'cash' && a.lumpSum) parts.push(`일시금 ${formatWon(a.lumpSum)}`);
  }
  if (a.durationMonths != null) parts.push(`${a.durationMonths}개월`);
  return parts.join(' · ') || '금액 정보 확인 필요';
}

/** 모집 상태. 날짜 문자열(YYYY-MM-DD)끼리 비교한다. */
export function periodStatus(period, today = new Date()) {
  if (!period) return { closed: false, label: '모집 기간 확인 필요' };
  if (period.always) return { closed: false, label: '상시 모집' };
  const { start, end } = period;
  if (!start && !end) return { closed: false, label: '모집 기간 확인 필요' };
  const pad = (n) => String(n).padStart(2, '0');
  const now = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const range = `${start ?? ''} ~ ${end ?? ''}`.trim();
  if (end && end < now) return { closed: true, label: `모집 마감 (${range})` };
  if (start && start > now) return { closed: false, label: `모집 예정 (${range})` };
  return { closed: false, label: `모집 중 (${range})` };
}

/** 공고 원문으로 가는 링크. http(s) 신청 링크가 우선이고, 없으면 저장소의 원문 파일. */
export function sourceLink({ applyUrl, sourceFile }) {
  if (/^https?:\/\//i.test(applyUrl ?? '')) return applyUrl;
  if (/^data\/raw\/[\w-]+(\.[\w-]+)*$/.test(sourceFile ?? '')) return sourceFile;
  return null;
}
