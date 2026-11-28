// 로컬 확인용 정적 서버. 설치할 패키지 없음.  npm start → http://localhost:5173/app.html

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT) || 5173;
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.txt': 'text/plain',
};

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path === '/') path = '/index.html';
    const relative = normalize(path).replace(/^[\\/]+/, '');
    const type = TYPES[extname(relative)];
    // .env 같은 숨김 파일과 폴더 밖 경로, 목록에 없는 형식은 주지 않는다
    if (!type || relative.split(sep).some((part) => part.startsWith('.'))) throw new Error('blocked');
    const body = await readFile(join(ROOT, relative));
    res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`http://localhost:${PORT}/app.html`);
});
