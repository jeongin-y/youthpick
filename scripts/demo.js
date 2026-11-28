// 페르소나 A(자취하는 대학생)로 판별 + 시뮬레이션을 돌려본다.
//   npm run demo
// data/benefits.json 이 있으면 그것을, 없으면 data/benefits.sample.json 을 쓴다.

import { readFile } from 'node:fs/promises';
import { judgeBenefit, STATUS_ICON } from '../src/eligibility.js';
import { compare } from '../src/simulate.js';

async function loadBenefits() {
  for (const f of ['data/benefits.json', 'data/benefits.sample.json']) {
    try {
      const db = JSON.parse(await readFile(f, 'utf8'));
      console.log(`데이터: ${f}\n`);
      return db.benefits;
    } catch {}
  }
  throw new Error('혜택 데이터가 없습니다.');
}

const profile = { age: 21, region: '서울', status: 'student', annualIncome: 7_800_000, independent: true };
const goal = 10_000_000;
const monthlySaving = 200_000;
const won = (n) => `${(n / 10_000).toLocaleString()}만원`;

const benefits = await loadBenefits();

console.log(`페르소나 A: 만 ${profile.age}세, ${profile.region}, 대학생, 자취, 연소득 ${won(profile.annualIncome)}`);
console.log(`목표 ${won(goal)}, 월 ${won(monthlySaving)} 저축\n`);

const judged = benefits.map((b) => judgeBenefit(b, profile));
for (const j of judged) {
  console.log(`■ ${j.title}  → ${j.overall}`);
  for (const r of j.results) console.log(`   ${STATUS_ICON[r.status]} ${r.label}${r.reason ? `  (${r.reason})` : ''}`);
  if (j.nearMiss) console.log(`   💡 "${j.nearMiss.label}" 조건만 맞추면 받을 수 있어요`);
}

// ❌가 없는 혜택(✅ 또는 ❓)만 시뮬레이션에 넣는다
const usable = benefits.filter((b) => judged.find((j) => j.id === b.id).overall !== 'ineligible');
const result = compare({ goal, monthlySaving, benefits: usable });

console.log(`\n혜택 없이: ${result.baseMonths}개월`);
for (const e of result.each) console.log(`  + ${e.title}: ${e.months}개월 (${e.savedMonths}개월 단축)`);
console.log(`모두 쓰면: ${result.combined.months}개월 (${result.combined.savedMonths}개월 단축)`);
console.log('\n계산 가정:');
for (const a of result.assumptions) console.log(`  · ${a}`);
