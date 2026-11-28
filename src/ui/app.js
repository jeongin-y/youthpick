// 앱 골격: 데이터 불러오기 + 주소(#) 기반 화면 전환.
//
// 캘린더(B) 붙이는 법: src/calendar/ 에 mountCalendar(container, { benefits }) 를 만들고,
// 아래 "캘린더 연결" 부분에서 import 해서 한 번 호출하면 된다.

import { el } from './dom.js';
import { createSimulator } from './simulator.js';

// scripts/demo.js 와 같은 순서: 실제 데이터가 있으면 그것을, 없으면 샘플을 쓴다.
async function loadBenefits() {
  for (const file of ['data/benefits.json', 'data/benefits.sample.json']) {
    try {
      const res = await fetch(file, { cache: 'no-cache' });
      if (!res.ok) continue;
      const { benefits } = await res.json();
      if (Array.isArray(benefits)) return benefits;
    } catch {
      // 다음 파일을 시도한다
    }
  }
  throw new Error('혜택 데이터를 불러오지 못했어요.');
}

function route() {
  const hash = location.hash.slice(1);
  if (hash === 'calendar') return { view: 'calendar' };
  return { view: 'simulator', step: Number(/^step-([1-4])$/.exec(hash)?.[1] ?? 1) };
}

try {
  const benefits = await loadBenefits();
  const isSample = benefits.some((b) => b.id.startsWith('sample-'));
  document.getElementById('sample-notice').hidden = !isSample;

  const simulator = createSimulator({ benefits, goTo: (n) => { location.hash = `step-${n}`; } });

  // 캘린더 연결: 예) mountCalendar(document.getElementById('view-calendar'), { benefits });

  const render = () => {
    const { view, step } = route();
    for (const section of document.querySelectorAll('[data-view]')) {
      section.hidden = section.dataset.view !== view;
    }
    for (const tab of document.querySelectorAll('[data-tab]')) {
      if (tab.dataset.tab === view) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    }
    if (view === 'simulator') {
      const shown = simulator.show(step);
      if (shown !== step) history.replaceState(null, '', `#step-${shown}`);
    }
    window.scrollTo(0, 0);
  };
  window.addEventListener('hashchange', render);
  render();
} catch (error) {
  document.getElementById('main').replaceChildren(el('p', { class: 'error' },
    `${error.message} 파일을 직접 열지 말고 "npm start"로 실행해 주세요.`));
}
