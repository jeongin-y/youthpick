// 목표 시뮬레이션 4단계 화면.

import { STATUS_ICON, UNKNOWN } from '../eligibility.js';
import { renderChart, renderTable } from './chart.js';
import { el } from './dom.js';
import {
  INCOME_BANDS, PERSONA_A, amountLabel, arrivalLabel, buildProfile, formatWon,
  judgeAll, manToWon, periodStatus, plan, sourceLink,
} from './model.js';
import { simulate } from '../simulate.js';

const OVERALL = {
  eligible: { label: '받을 수 있어요', cls: 'ok' },
  check: { label: '확인 필요', cls: 'ask' },
  ineligible: { label: '지금은 해당 안 됨', cls: 'no' },
};
const STATUS_TEXT = { met: '충족', unmet: '미충족', unknown: '확인 필요' };

export function createSimulator({ benefits, goTo }) {
  const $ = (id) => document.getElementById(id);
  const form = $('sim-form');
  const off = new Set(); // 사용자가 끈 혜택 id
  let step = 1;

  $('income').append(...INCOME_BANDS.map((b) => el('option', { value: b.id }, b.label)));

  const values = () => Object.fromEntries(new FormData(form));
  const money = () => {
    const v = values();
    return { goal: manToWon(v.goal), monthlySaving: manToWon(v.saving) };
  };
  const goalReady = () => {
    const { goal, monthlySaving } = money();
    return goal > 0 && monthlySaving != null;
  };

  // 1단계: 혜택 없이 닿는 시점
  function renderBase() {
    const out = $('base-result');
    $('to-step-2').disabled = !goalReady();
    if (!goalReady()) {
      out.replaceChildren(el('p', { class: 'muted' }, '목표 금액과 월 저축 가능액을 입력해 주세요.'));
      return;
    }
    const { goal, monthlySaving } = money();
    const { months } = simulate({ goal, monthlySaving });
    out.replaceChildren(
      el('p', { class: 'muted' }, '혜택 없이 모으면'),
      months == null
        ? el('p', { class: 'big' }, '50년 안에 닿기 어려워요')
        : el('p', { class: 'big' }, `약 ${months}개월`),
      el('p', { class: 'muted' }, months == null
        ? '월 저축 가능액을 늘리거나 혜택을 확인해 보세요.'
        : `${arrivalLabel(months)}쯤 ${formatWon(goal)}에 닿아요.`),
    );
  }

  // 3단계: 혜택 카드
  function renderCards() {
    const judged = judgeAll(benefits, buildProfile(values()));
    const count = judged.filter((j) => j.judge.overall !== 'ineligible').length;
    $('card-summary').textContent =
      `혜택 ${judged.length}개 중 ${count}개는 받을 수 있거나 확인이 필요해요.`;
    $('cards').replaceChildren(...judged.map(card));
  }

  function card({ benefit, judge }) {
    const overall = OVERALL[judge.overall];
    const period = periodStatus(benefit.period);
    const link = sourceLink(benefit);
    return el('article', { class: `card ${overall.cls}`, 'data-id': benefit.id },
      el('div', { class: 'badges' },
        el('span', { class: `badge ${overall.cls}` }, overall.label),
        el('span', { class: `badge ${period.closed ? 'closed' : 'plain'}` }, period.label)),
      el('h3', {}, benefit.title),
      el('p', { class: 'muted' }, `${benefit.agency} · ${amountLabel(benefit)}`),
      benefit.summary && el('p', { class: 'summary' }, benefit.summary),
      judge.nearMiss && el('p', { class: 'near' }, `💡 "${judge.nearMiss.label}" 조건만 맞추면 받을 수 있어요`),
      el('ul', { class: 'conditions' }, judge.results.map((c) => el('li', {},
        el('span', { class: 'icon', role: 'img', 'aria-label': STATUS_TEXT[c.status] }, STATUS_ICON[c.status]),
        el('div', {},
          el('strong', {}, c.label),
          c.reason && el('small', {}, c.reason),
          c.evidence && el('blockquote', {},
            c.evidenceVerified === false ? `원문에서 확인되지 않은 문장: ${c.evidence}` : c.evidence),
          c.status === UNKNOWN && (link
            ? el('a', { href: link, target: '_blank', rel: 'noopener noreferrer' }, '원문에서 확인하기 ↗')
            : el('small', {}, '원문 링크 준비 중')),
        )))),
    );
  }

  // 4단계: 켜기/끄기와 그래프
  function renderResult() {
    const { goal, monthlySaving } = money();
    const judged = judgeAll(benefits, buildProfile(values()));
    const result = plan({ goal, monthlySaving, judged, off });
    const { base, withBenefits, savedMonths } = result;

    let headline;
    if (!result.usable.length) headline = '지금 조건에 맞는 혜택이 없어요';
    else if (!result.selected.length) headline = '혜택을 켜서 비교해 보세요';
    else if (withBenefits.months == null) headline = '50년 안에 닿기 어려워요';
    else if (base.months == null) headline = `혜택을 쓰면 ${withBenefits.months}개월 만에 닿아요`;
    else if (savedMonths > 0) headline = `${savedMonths}개월 더 빨리 닿아요`;
    else headline = '도달 시점은 같아요';

    const monthsText = (m) => (m == null ? '도달 어려움' : `${m}개월`);
    $('headline').replaceChildren(
      el('p', { class: 'big' }, headline),
      el('p', { class: 'muted' }, `혜택 없이 ${monthsText(base.months)} → 선택한 혜택 ${monthsText(withBenefits.months)}`
        + (withBenefits.months != null ? ` (${arrivalLabel(withBenefits.months)}쯤)` : '')),
    );

    const saved = new Map(result.each.map((e) => [e.id, e]));
    $('toggles').replaceChildren(...judged.map(({ benefit, judge }) => {
      const usable = judge.overall !== 'ineligible';
      const one = saved.get(benefit.id);
      const period = periodStatus(benefit.period);
      const effect = !usable ? '조건이 맞지 않아 계산에서 뺐어요'
        : one.savedMonths == null ? `이것만 쓰면 ${monthsText(one.months)}`
        : `이것만 쓰면 ${one.savedMonths}개월 단축`;
      const input = el('input', {
        type: 'checkbox', role: 'switch', 'data-id': benefit.id,
        checked: usable && !off.has(benefit.id), disabled: !usable,
      });
      input.addEventListener('change', () => {
        if (input.checked) off.delete(benefit.id);
        else off.add(benefit.id);
        renderResult();
        $('toggles').querySelector(`input[data-id="${CSS.escape(benefit.id)}"]`).focus();
      });
      return el('label', { class: `toggle ${usable ? '' : 'disabled'}` },
        el('span', {},
          el('strong', {}, benefit.title),
          el('small', {}, effect),
          usable && judge.overall === 'check' && el('small', { class: 'warn' }, '❓ 확인이 필요한 조건이 있어요'),
          usable && period.closed && el('small', { class: 'warn' }, '이번 모집은 마감됐어요. 계산은 지금부터 받는다고 가정해서 실제와 다를 수 있어요.')),
        input);
    }));

    $('assumptions').replaceChildren(...result.assumptions.map((a) => el('li', {}, a)));
    renderTable($('table'), result);
    renderChart($('chart'), { goal, ...result });
  }

  function show(next) {
    step = next > 1 && !goalReady() ? 1 : next;
    for (const s of form.querySelectorAll('[data-step]')) s.hidden = Number(s.dataset.step) !== step;
    for (const li of document.querySelectorAll('#progress li')) {
      const n = Number(li.dataset.n);
      li.classList.toggle('done', n < step);
      if (n === step) li.setAttribute('aria-current', 'step');
      else li.removeAttribute('aria-current');
    }
    if (step === 1) renderBase();
    if (step === 3) renderCards();
    if (step === 4) renderResult();
    return step;
  }

  form.addEventListener('input', () => step === 1 && renderBase());
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (step < 4 && goalReady()) goTo(step + 1);
  });
  for (const button of form.querySelectorAll('[data-go]')) {
    button.addEventListener('click', () => goTo(Number(button.dataset.go)));
  }
  $('persona').addEventListener('click', () => {
    for (const [name, value] of Object.entries(PERSONA_A)) form.elements[name].value = value;
    off.clear();
    renderBase();
  });

  let width = 0;
  window.addEventListener('resize', () => {
    const now = $('chart').clientWidth;
    if (step === 4 && now && now !== width) {
      width = now;
      renderResult();
    }
  });

  return { show };
}
