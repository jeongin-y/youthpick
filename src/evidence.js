const squash = (s) => s.replace(/\s+/g, '');

// AI가 근거 문장을 지어냈는지 확인: 원문에 (공백 무시하고) 그대로 있어야 인정한다.
// AI가 소제목과 본문 줄을 이어 붙여 오는 경우가 있어, 줄마다 따로 원문에 있으면 인정한다.
// 못 찾은 조건은 evidenceVerified=false → 판별 단계에서 ❓로 처리된다.
export function verifyEvidence(benefit, sourceText) {
  const src = squash(sourceText);
  for (const c of benefit.conditions) {
    const parts = c.evidence.split(/\r?\n/).map(squash).filter(Boolean);
    c.evidenceVerified = parts.length > 0 && parts.every((p) => src.includes(p));
  }
  return benefit;
}
