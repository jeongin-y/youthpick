# 유스픽 · 청년 목표자산 내비게이터

무자본 청년이 목표 자산을 정하면, 받을 수 있는 청년 혜택을 찾아 **"이 혜택을 쓰면 목표에 몇 개월 더 빨리 닿는지"** 보여주는 서비스입니다.

## 구조

```
[매일 수집]  data/raw/*.txt (공고 원문)
               → scripts/extract.js (OpenAI로 자격조건 구조화, 바뀐 공고만)
               → data/benefits.json
[사용자 화면] benefits.json → src/eligibility.js (✅/❌/❓ 판별, 규칙 기반)
                            → src/simulate.js    (목표 도달 개월 계산, 규칙 기반)
```

AI는 줄글 조건을 쪼개는 데만 씁니다. 판별과 금액 계산은 코드로 하므로 AI가 숫자를 틀려도 결과에 섞이지 않습니다.
AI가 붙인 근거 문장이 원문에 없으면 그 조건은 ❓로 처리합니다.

## 실행

Node.js 22 이상, 외부 패키지 없음.

```bash
npm start              # 화면 실행 → http://localhost:5173/app.html
npm test              # 판별·시뮬레이션 테스트
npm run demo          # 페르소나 A로 판별 + 시뮬레이션 출력
npm run extract:dry   # 어떤 공고가 API로 처리될지 확인 (호출 없음)
npm run extract       # 실제 구조화 (.env 필요)
```

`.env.example`을 `.env`로 복사하고 `OPENAI_API_KEY`를 넣으세요. `.env`는 커밋되지 않습니다.
**API 키는 절대 브라우저 코드에 넣지 않습니다.**

## 비용 관리

- 원문 해시가 같은 공고는 다시 호출하지 않습니다 (`--force`로 강제).
- 한 번에 `MAX_FILES_PER_RUN`건까지만 처리합니다.
- OpenAI 대시보드에서 월 사용 한도를 걸어 두세요.

## 데이터

`data/raw/sample-*.txt`와 `data/benefits.sample.json`은 **테스트용 가상 공고**이며 실제 정책이 아닙니다.
