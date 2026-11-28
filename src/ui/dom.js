// 작은 DOM 도우미. 혜택 데이터는 API·AI에서 온 글자라서 innerHTML 없이 텍스트로만 넣는다.

export function el(tag, attrs = {}, ...children) {
  return fill(document.createElement(tag), attrs, children);
}

export function svg(tag, attrs = {}, ...children) {
  return fill(document.createElementNS('http://www.w3.org/2000/svg', tag), attrs, children);
}

function fill(node, attrs, children) {
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    node.setAttribute(key, value === true ? '' : String(value));
  }
  node.append(...children.flat().filter((c) => c != null && c !== false));
  return node;
}
