// 공고 1건을 구조화한 결과의 형태. OpenAI Structured Outputs(strict)에 그대로 넘긴다.
// strict 모드는 모든 필드가 required + additionalProperties:false 여야 하므로, 없는 값은 null로 받는다.

const num = (description) => ({ type: ['number', 'null'], description });

export const CONDITION_FIELDS = ['age', 'region', 'status', 'income', 'household', 'other'];
export const STATUS_VALUES = ['student', 'jobseeker', 'employed'];
export const HOUSEHOLD_VALUES = ['independent', 'with_parents'];

export const BENEFIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'agency', 'category', 'benefitType', 'amount', 'conditions', 'period', 'summary', 'documents', 'applyUrl'],
  properties: {
    title: { type: 'string' },
    agency: { type: 'string', description: '주관 기관' },
    category: { type: 'string', enum: ['savings', 'housing', 'job', 'education', 'transport', 'other'] },
    benefitType: {
      type: 'string',
      enum: ['contribution', 'expense_reduction', 'cash'],
      description: 'contribution=저축액에 비례해 정부가 더해주는 기여금, expense_reduction=월세·교통비처럼 지출을 줄여주는 지원, cash=수당·장학금처럼 현금 지급',
    },
    amount: {
      type: 'object',
      additionalProperties: false,
      required: ['monthly', 'lumpSum', 'durationMonths', 'matchRate', 'matchCapMonthly', 'depositCapMonthly'],
      properties: {
        monthly: num('매월 지급·절감액(원). 없으면 null'),
        lumpSum: num('일시금(원). 없으면 null'),
        durationMonths: num('지원 기간 또는 만기(개월). 없으면 null'),
        matchRate: num('기여금 비율(0~1 소수, 6%면 0.06). contribution이 아니면 null'),
        matchCapMonthly: num('월 기여금 상한(원). 없으면 null'),
        depositCapMonthly: num('월 납입 한도(원). 없으면 null'),
      },
    },
    conditions: {
      type: 'array',
      description: '자격조건을 한 조건씩 쪼갠 목록',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['field', 'op', 'min', 'max', 'values', 'label', 'evidence'],
        properties: {
          field: { type: 'string', enum: CONDITION_FIELDS },
          op: { type: 'string', enum: ['range', 'in', 'not_in', 'text'] },
          min: num('range일 때 최솟값 (나이는 만 나이, 소득은 연소득 원)'),
          max: num('range일 때 최댓값'),
          values: {
            type: ['array', 'null'],
            items: { type: 'string' },
            description: 'in/not_in일 때 값 목록. region=시·도 짧은 이름(서울, 경기…) 또는 전국, status=student|jobseeker|employed, household=independent|with_parents',
          },
          label: { type: 'string', description: '사용자에게 보여줄 짧은 조건 설명' },
          evidence: { type: 'string', description: '이 조건의 근거가 된 원문 문장. 원문 그대로 복사' },
        },
      },
    },
    period: {
      type: 'object',
      additionalProperties: false,
      required: ['start', 'end', 'always'],
      properties: {
        start: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
        end: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
        always: { type: 'boolean', description: '상시 모집이면 true' },
      },
    },
    summary: { type: 'string', description: '지원 내용·대상·신청 방법을 2~3문장으로' },
    documents: { type: 'array', items: { type: 'string' }, description: '필요 서류' },
    applyUrl: { type: ['string', 'null'] },
  },
};

export const SYSTEM_PROMPT = `너는 한국 청년정책 공고를 구조화하는 도구다.
규칙:
- 공고에 적힌 내용만 쓴다. 추측해서 숫자를 채우지 말고, 없으면 null.
- 금액은 원 단위 정수 (20만원 → 200000). 비율은 0~1 소수.
- 자격조건은 한 조건씩 나눈다. 원문의 조건을 빠뜨리지 않는다.
- field별 규칙:
  · age: op="range", 만 나이.
  · region: op="in", values는 시·도 짧은 이름(서울, 부산, 경기, 전북 …) 또는 "전국".
  · status: values는 student(재학·휴학생), jobseeker(미취업자·구직자), employed(재직자)만 쓴다. "미취업자"는 status in ["jobseeker"], "재학생 제외"는 status not_in ["student"].
  · household: values는 independent(부모와 따로 사는 독립 가구), with_parents만 쓴다.
  · income: 본인 연소득이 원 단위 금액으로 적힌 경우만 op="range". "중위소득 150%"처럼 비율이거나 가구소득 기준이면 field="other".
  · 위로 표현할 수 없는 조건(소득 유무, 무주택, 중위소득 등)은 field="other", op="text".
- "~도 신청할 수 있습니다"처럼 대상을 넓혀 주는 문구는 조건이 아니다. 조건 목록에 넣지 않는다.
- 지원 대상 문장 하나에 여러 조건이 섞여 있으면 각각 따로 만든다.
  예) "서울특별시에 거주하는 만 19세 이상 34세 이하 미취업 청년"
    → region in ["서울"] / age range 19~34 / status in ["jobseeker"]  (세 조건 모두 같은 문장을 evidence로)
- evidence는 원문의 한 줄을 그대로 쓴다. 소제목을 앞에 붙이지 않는다.
- label은 사용자에게 보여줄 구체적인 문구 (예: "만 19~34세", "서울 거주", "연소득 3,600만원 이하"). "나이", "소득" 같은 항목명만 쓰지 않는다.
- amount.monthly는 매달 지급·절감되는 금액만. 기여금형(contribution)은 matchRate·상한으로 표현하고 monthly는 null.
- evidence에는 원문 문장을 글자 그대로 복사한다. 바꿔 쓰지 않는다.`;
