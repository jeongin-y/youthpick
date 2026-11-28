// 목표 도달 시뮬레이션. 월 단위로 잔액을 쌓아 목표에 닿는 달을 찾는다.

export const ASSUMPTIONS = [
  '이자는 계산에 넣지 않았습니다.',
  '정부기여금은 만기 달에 한 번에 들어온다고 가정합니다.',
  '지출을 줄여주는 혜택(월세·교통비 지원 등)은 아낀 금액을 전부 저축한다고 가정합니다.',
  '혜택끼리의 중복수혜 제한은 아직 반영하지 않았습니다.',
];

const MAX_MONTHS = 600;

/**
 * @param {{goal:number, monthlySaving:number, benefits?:Array, maxMonths?:number}} input
 * @returns {{months:number|null, timeline:number[]}} months=null이면 maxMonths 안에 도달 못 함
 */
export function simulate({ goal, monthlySaving, benefits = [], maxMonths = MAX_MONTHS }) {
  let balance = 0;
  const pending = new Map(); // 만기 전까지 쌓이는 기여금
  const timeline = [];

  for (let m = 1; m <= maxMonths; m++) {
    balance += monthlySaving;

    for (const b of benefits) {
      const a = b.amount;
      const active = a.durationMonths == null || m <= a.durationMonths;

      if (b.benefitType === 'expense_reduction' || b.benefitType === 'cash') {
        if (active) balance += a.monthly ?? 0;
        if (b.benefitType === 'cash' && m === 1) balance += a.lumpSum ?? 0;
      }

      if (b.benefitType === 'contribution' && active) {
        const deposit = Math.min(monthlySaving, a.depositCapMonthly ?? Infinity);
        let c = deposit * (a.matchRate ?? 0);
        if (a.matchCapMonthly != null) c = Math.min(c, a.matchCapMonthly);
        c = Math.round(c);
        if (a.durationMonths == null) {
          balance += c; // 만기 정보가 없으면 매달 들어온다고 본다
        } else {
          const acc = (pending.get(b.id) ?? 0) + c;
          if (m === a.durationMonths) {
            balance += acc;
            pending.delete(b.id);
          } else {
            pending.set(b.id, acc);
          }
        }
      }
    }

    timeline.push(balance);
    if (balance >= goal) return { months: m, timeline };
  }
  return { months: null, timeline };
}

/**
 * 혜택 없이 / 혜택별로 / 전부 켰을 때를 비교한다.
 */
export function compare({ goal, monthlySaving, benefits }) {
  const base = simulate({ goal, monthlySaving });
  const saved = (r) => (base.months != null && r.months != null ? base.months - r.months : null);

  const each = benefits.map((b) => {
    const r = simulate({ goal, monthlySaving, benefits: [b] });
    return { id: b.id, title: b.title, months: r.months, savedMonths: saved(r) };
  });
  each.sort((x, y) => (y.savedMonths ?? -1) - (x.savedMonths ?? -1));

  const all = simulate({ goal, monthlySaving, benefits });
  return {
    baseMonths: base.months,
    each,
    combined: { months: all.months, savedMonths: saved(all) },
    assumptions: ASSUMPTIONS,
  };
}
