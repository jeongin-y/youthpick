// data/raw/*.txt 공고 원문 → OpenAI로 조건 구조화 → data/benefits.json
//
//   npm run extract:dry   어떤 공고가 처리될지만 보여줌 (API 호출 없음)
//   npm run extract       실제 실행 (.env 의 OPENAI_API_KEY 필요)
//   npm run extract -- --force   원문이 안 바뀐 공고도 다시 처리
//
// 비용 절약: 원문 해시가 그대로인 공고는 건너뛴다. 한 번에 MAX_FILES_PER_RUN 건까지만 처리한다.

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { BENEFIT_SCHEMA, SYSTEM_PROMPT } from '../src/schema.js';
import { verifyEvidence } from '../src/evidence.js';
import { normalizeBenefit } from '../src/normalize.js';

const RAW_DIR = 'data/raw';
const OUT_FILE = 'data/benefits.json';

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const FORCE = args.has('--force');
const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1';
const MAX_FILES = Number(process.env.MAX_FILES_PER_RUN || 20);

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

async function loadExisting() {
  try {
    return JSON.parse(await readFile(OUT_FILE, 'utf8'));
  } catch {
    return { updatedAt: null, benefits: [] };
  }
}

async function callOpenAI(text) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'benefit', strict: true, schema: BENEFIT_SCHEMA },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }
  const data = await res.json();
  const msg = data.choices?.[0]?.message;
  if (msg?.refusal) throw new Error(`모델이 거부함: ${msg.refusal}`);
  return { parsed: JSON.parse(msg.content), usage: data.usage };
}

async function main() {
  const files = (await readdir(RAW_DIR)).filter((f) => f.endsWith('.txt')).sort();
  const db = await loadExisting();
  const byId = new Map(db.benefits.map((b) => [b.id, b]));

  const todo = [];
  for (const file of files) {
    const text = await readFile(path.join(RAW_DIR, file), 'utf8');
    const id = path.basename(file, '.txt');
    const hash = sha256(text);
    if (!FORCE && byId.get(id)?.sourceHash === hash) continue;
    todo.push({ id, file, text, hash });
  }

  const batch = todo.slice(0, MAX_FILES);
  console.log(`공고 ${files.length}건 중 처리 대상 ${todo.length}건, 이번 실행 ${batch.length}건 (모델: ${MODEL})`);
  for (const t of batch) console.log(`  - ${t.file} (${t.text.length}자)`);
  if (todo.length > batch.length) console.log(`  … 나머지 ${todo.length - batch.length}건은 다음 실행에서 처리`);

  if (DRY_RUN || batch.length === 0) return;
  if (!process.env.OPENAI_API_KEY) {
    console.error('\nOPENAI_API_KEY가 없습니다. .env.example을 .env로 복사하고 키를 넣어주세요.');
    process.exitCode = 1;
    return;
  }

  let inTok = 0;
  let outTok = 0;
  let failed = 0;
  for (const t of batch) {
    try {
      const { parsed: raw, usage } = await callOpenAI(t.text);
      inTok += usage?.prompt_tokens ?? 0;
      outTok += usage?.completion_tokens ?? 0;
      const parsed = normalizeBenefit(verifyEvidence(raw, t.text));
      const unverified = parsed.conditions.filter((c) => !c.evidenceVerified).length;
      for (const c of parsed.conditions) {
        if (c.normalizeNote) console.log(`  ↳ ❓로 변경: "${c.label}" — ${c.normalizeNote}`);
      }
      byId.set(t.id, {
        id: t.id,
        ...parsed,
        sourceFile: path.posix.join(RAW_DIR, t.file),
        sourceHash: t.hash,
        extractedAt: new Date().toISOString(),
        model: MODEL,
      });
      console.log(`✔ ${t.id}: 조건 ${parsed.conditions.length}개${unverified ? `, 근거 미확인 ${unverified}개(❓ 처리)` : ''}`);
    } catch (err) {
      failed++;
      console.error(`✘ ${t.id}: ${err.message}`);
    }
  }

  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  const benefits = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  await writeFile(OUT_FILE, JSON.stringify({ updatedAt: new Date().toISOString(), benefits }, null, 2) + '\n');
  console.log(`\n${OUT_FILE} 저장 (혜택 ${benefits.length}개). 토큰 사용: 입력 ${inTok}, 출력 ${outTok}`);
  if (failed) process.exitCode = 1;
}

main();
