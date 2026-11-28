// 목표 도달 그래프: "혜택 없이"(회색 점선)와 "선택한 혜택"(보라 실선)의 누적 금액.

import { el, svg } from './dom.js';
import { formatWon } from './model.js';

const HEIGHT = 260;
const PAD = { top: 30, right: 18, bottom: 28, left: 52 };

/**
 * @param {HTMLElement} box
 * @param {{goal:number, base:{months:number|null,timeline:number[]}, withBenefits:{months:number|null,timeline:number[]}}} data
 */
export function renderChart(box, { goal, base, withBenefits }) {
  const width = Math.max(box.clientWidth, 280);
  const lastMonth = Math.max(base.timeline.length, withBenefits.timeline.length, 1);
  const top = Math.max(goal, ...base.timeline, ...withBenefits.timeline) * 1.04;
  const x = (m) => PAD.left + (m / lastMonth) * (width - PAD.left - PAD.right);
  const y = (v) => HEIGHT - PAD.bottom - (v / top) * (HEIGHT - PAD.top - PAD.bottom);
  const path = (timeline) =>
    [0, ...timeline].map((v, m) => `${m ? 'L' : 'M'}${x(m).toFixed(1)} ${y(v).toFixed(1)}`).join('');

  const root = svg('svg', {
    width, height: HEIGHT, viewBox: `0 0 ${width} ${HEIGHT}`, role: 'img',
    'aria-label': `누적 금액 그래프. 혜택 없이 ${monthsText(base)}, 선택한 혜택을 쓰면 ${monthsText(withBenefits)}.`,
  });

  // 가로 눈금
  const step = niceStep(top / 4);
  for (let v = 0; v <= top; v += step) {
    root.append(
      svg('line', { class: 'grid', x1: PAD.left, x2: width - PAD.right, y1: y(v), y2: y(v) }),
      svg('text', { class: 'tick', x: PAD.left - 8, y: y(v) + 4, 'text-anchor': 'end' },
        v === 0 ? '0' : `${(v / 10_000).toLocaleString('ko-KR')}만`),
    );
  }
  // 세로축 눈금(개월)
  const xStep = [3, 6, 12, 24, 60, 120].find((s) => lastMonth / s <= 5) ?? 120;
  for (let m = 0; m <= lastMonth; m += xStep) {
    root.append(svg('text', { class: 'tick', x: x(m), y: HEIGHT - 8, 'text-anchor': m === 0 ? 'start' : 'middle' },
      m === 0 ? '지금' : `${m}개월`));
  }

  root.append(
    svg('line', { class: 'goal', x1: PAD.left, x2: width - PAD.right, y1: y(goal), y2: y(goal) }),
    svg('text', { class: 'goal-label', x: PAD.left + 4, y: y(goal) - 7 }, `목표 ${formatWon(goal)}`),
    svg('path', { class: 'line base', d: path(base.timeline) }),
    svg('path', { class: 'line plus', d: path(withBenefits.timeline) }),
  );

  // 도달 지점 표시. 두 점이 가까우면 라벨 하나는 아래쪽에 둔다.
  const ends = [
    { run: withBenefits, cls: 'plus' },
    { run: base, cls: 'base' },
  ].filter((e) => e.run.months != null);
  const close = ends.length === 2 && Math.abs(x(ends[0].run.months) - x(ends[1].run.months)) < 52;
  const same = ends.length === 2 && ends[0].run.months === ends[1].run.months;
  ends.forEach(({ run, cls }, i) => {
    const cx = x(run.months);
    const cy = y(run.timeline[run.months - 1]);
    root.append(svg('circle', { class: `dot ${cls}`, cx, cy, r: 5 }));
    if (same && i === 1) return;
    const below = close && i === 1;
    root.append(svg('text', {
      class: 'end-label', x: Math.min(cx, width - 4), y: below ? cy + 20 : cy - 11,
      'text-anchor': cx > width - 40 ? 'end' : 'middle',
    }, `${run.months}개월`));
  });

  // 손가락·마우스를 올리면 그 달의 금액
  const cross = svg('line', { class: 'cross', y1: PAD.top, y2: HEIGHT - PAD.bottom, visibility: 'hidden' });
  const hit = svg('rect', { x: PAD.left, y: 0, width: width - PAD.left - PAD.right, height: HEIGHT, fill: 'transparent' });
  root.append(cross, hit);
  const tip = el('div', { class: 'tip', hidden: true });

  const show = (event) => {
    const px = event.clientX - root.getBoundingClientRect().left;
    const month = Math.min(lastMonth, Math.max(1,
      Math.round(((px - PAD.left) / (width - PAD.left - PAD.right)) * lastMonth)));
    cross.setAttribute('x1', x(month));
    cross.setAttribute('x2', x(month));
    cross.setAttribute('visibility', 'visible');
    tip.replaceChildren(
      el('b', {}, `${month}개월 뒤`),
      row('plus', '선택한 혜택', withBenefits, month),
      row('base', '혜택 없이', base, month),
    );
    tip.hidden = false;
    const left = x(month) + 12;
    tip.style.left = `${left + tip.offsetWidth > width ? x(month) - tip.offsetWidth - 12 : left}px`;
  };
  const hide = () => {
    tip.hidden = true;
    cross.setAttribute('visibility', 'hidden');
  };
  hit.addEventListener('pointermove', show);
  hit.addEventListener('pointerdown', show);
  hit.addEventListener('pointerleave', hide);

  box.replaceChildren(root, tip);
}

/** 그래프와 같은 내용을 표로 (6개월 간격 + 도달한 달) */
export function renderTable(table, { base, withBenefits }) {
  const last = Math.max(base.timeline.length, withBenefits.timeline.length);
  const months = new Set([base.months, withBenefits.months, last].filter(Boolean));
  for (let m = 6; m <= last; m += 6) months.add(m);
  table.replaceChildren(
    el('thead', {}, el('tr', {}, el('th', {}, '개월'), el('th', {}, '선택한 혜택'), el('th', {}, '혜택 없이'))),
    el('tbody', {}, [...months].sort((a, b) => a - b).map((m) =>
      el('tr', {}, el('td', {}, `${m}`), el('td', {}, valueAt(withBenefits, m)), el('td', {}, valueAt(base, m))))),
  );
}

function row(cls, name, run, month) {
  return el('div', {}, el('i', { class: cls }), `${name} `, el('strong', {}, valueAt(run, month)));
}

// 계산은 목표에 닿는 달에서 멈추므로 그 뒤는 "달성"으로 표시한다.
function valueAt(run, month) {
  return month <= run.timeline.length ? formatWon(run.timeline[month - 1]) : '목표 달성';
}

function monthsText(run) {
  return run.months == null ? '목표에 닿지 않음' : `${run.months}개월`;
}

function niceStep(raw) {
  const unit = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((k) => k * unit).find((s) => s >= raw);
}
