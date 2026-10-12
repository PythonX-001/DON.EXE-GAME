'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const GAME_FILE = path.join(ROOT, 'index.html');
const DB_FILE = path.join(ROOT, 'scores.json');
const MAX_SCORE = 625; // DON.EXE's current maximum possible score.
const MAX_BODY = 8192;

function readScores() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Could not read scores.json:', error.message);
    return [];
  }
}

function writeScores(scores) {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(scores, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, DB_FILE);
}

function rankFor(score) {
  if (score >= 0.9 * MAX_SCORE) return 'SOUL MATE';
  if (score >= 0.75 * MAX_SCORE) return 'BEST FRIEND';
  if (score >= 0.55 * MAX_SCORE) return 'BROTHER / SISTER';
  if (score >= 0.35 * MAX_SCORE) return 'CLOSE FRIEND';
  if (score >= 0.15 * MAX_SCORE) return 'FRIEND';
  if (score >= -0.08 * MAX_SCORE) return "YOU DON'T KNOW ME";
  return "I'M DISAPPOINTED — JUST UNFRIEND ME";
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(data === null ? '' : JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (Buffer.byteLength(body, 'utf8') > MAX_BODY) {
        reject(Object.assign(new Error('Request body too large'), { statusCode: 413 }));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { reject(Object.assign(new Error('Invalid JSON'), { statusCode: 400 })); }
    });
    req.on('error', reject);
  });
}

const leaderboardHtml = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>DON.EXE — Leaderboard</title><style>
:root{color-scheme:dark;--bg:#0b0d14;--panel:#141a2e;--purple:#6b5b8a;--red:#b0303a;--text:#c9cde0;--muted:#8a90ab}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:20px/1.35 'Courier New',monospace;padding:24px}
main{max-width:860px;margin:0 auto}.tag{color:var(--red);letter-spacing:3px}.top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}h1{font-size:clamp(24px,5vw,42px);margin:8px 0}p{color:var(--muted)}a,button{font:inherit;color:var(--text);background:#0b0d14;border:2px solid var(--purple);padding:9px 14px;text-decoration:none;cursor:pointer}a:hover,button:hover{border-color:var(--red)}.panel{border:2px solid var(--purple);background:var(--panel);padding:16px;margin-top:20px;box-shadow:6px 6px #05060a}.row{display:grid;grid-template-columns:60px minmax(100px,1fr) 110px minmax(130px,auto);gap:12px;align-items:center;border-bottom:1px solid #28304e;padding:12px 4px}.row:last-child{border-bottom:0}.heading{color:var(--muted);font-size:15px}.score{text-align:right;font-variant-numeric:tabular-nums}.place{color:#e8d27a}.name{overflow-wrap:anywhere}.empty{text-align:center;padding:28px 8px}.foot{font-size:15px;margin-top:20px}@media(max-width:540px){body{padding:12px}.panel{padding:10px}.row{grid-template-columns:32px minmax(60px,1fr) 76px;gap:8px}.rank{display:none}.score{font-size:18px}.heading .rank{display:none}}
</style></head><body><main><div class="top"><div><div class="tag">DON.EXE / PUBLIC ARCHIVE</div><h1>PLAYER RANKING</h1><p>Scores update as players progress through the game.</p></div><div><a href="/">← BACK TO GAME</a> <button id="refresh">REFRESH</button></div></div><section class="panel"><div class="row heading"><div>#</div><div>PLAYER</div><div class="score">SCORE</div><div class="rank">RANK</div></div><div id="rows"><div class="empty">LOADING SCORES...</div></div></section><p id="status" aria-live="polite"></p><p class="foot">Only public usernames, scores, and game ranks are shown. Players can opt out from the game settings. Rankings are game humor, not a measure of anyone's real relationships.</p></main>
<script>
const rows=document.getElementById('rows'),statusLine=document.getElementById('status');
async function load(){rows.replaceChildren(Object.assign(document.createElement('div'),{className:'empty',textContent:'LOADING SCORES...'}));try{const res=await fetch('/api/scores',{cache:'no-store'});if(!res.ok)throw new Error('HTTP '+res.status);const data=await res.json();rows.replaceChildren();if(!data.scores.length){rows.append(Object.assign(document.createElement('div'),{className:'empty',textContent:'NO SCORES YET — BE THE FIRST TO PLAY.'}));}else data.scores.forEach((item,i)=>{const row=document.createElement('div');row.className='row';const place=document.createElement('div');place.className='place';place.textContent=String(i+1).padStart(2,'0');const name=document.createElement('div');name.className='name';name.textContent=item.name;const score=document.createElement('div');score.className='score';score.textContent=item.score+'/'+item.maxScore;const rank=document.createElement('div');rank.className='rank';rank.textContent=item.rank;row.append(place,name,score,rank);rows.append(row);});statusLine.textContent='LAST UPDATED: '+new Date().toLocaleTimeString();}catch(e){rows.replaceChildren(Object.assign(document.createElement('div'),{className:'empty',textContent:'COULD NOT LOAD SCORES. START OR CHECK THE BACKEND SERVER.'}));statusLine.textContent='';}}
document.getElementById('refresh').addEventListener('click',load);load();
</script></body></html>`;

const server = http.createServer(async (req, res) => {
  const base = 'http://' + (req.headers.host || 'localhost');
  let url;
  try { url = new URL(req.url, base); }
  catch { sendJson(res, 400, { error: 'Bad request URL' }); return; }
  const pathname = decodeURIComponent(url.pathname);

  if (req.method === 'GET' && pathname === '/api/health') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/scores') {
    const scores = readScores()
      .filter(item => item && item.public !== false)
      .sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt)
      .slice(0, 100)
      .map(({ name, score, maxScore, rank }) => ({ name, score, maxScore, rank }));
    sendJson(res, 200, { scores });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/scores') {
    try {
      const body = await readBody(req);
      const playerId = String(body.playerId || '');
      const name = String(body.name || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim();
      const score = Number(body.score);
      const maxScore = Number(body.maxScore);
      if (!/^[a-zA-Z0-9-]{8,80}$/.test(playerId)) return sendJson(res, 400, { error: 'Invalid player ID' });
      if (name.length < 2 || name.length > 16) return sendJson(res, 400, { error: 'Username must be 2–16 characters' });
      if (!Number.isFinite(score) || score < -1000 || score > MAX_SCORE || maxScore !== MAX_SCORE) {
        return sendJson(res, 400, { error: 'Invalid score' });
      }
      const scores = readScores();
      const record = { playerId, name, score: Math.trunc(score), maxScore: MAX_SCORE, rank: rankFor(score), public: true, updatedAt: Date.now() };
      const index = scores.findIndex(item => item.playerId === playerId);
      if (index >= 0) scores[index] = record; else scores.push(record);
      writeScores(scores);
      sendJson(res, 200, { ok: true, score: record.score, rank: record.rank });
    } catch (error) {
      sendJson(res, error.statusCode || 500, { error: error.statusCode ? error.message : 'Could not save score' });
    }
    return;
  }

  const deleteMatch = pathname.match(/^\/api\/scores\/([a-zA-Z0-9-]{8,80})$/);
  if (req.method === 'DELETE' && deleteMatch) {
    const playerId = deleteMatch[1];
    const scores = readScores();
    const remaining = scores.filter(item => item.playerId !== playerId);
    if (remaining.length !== scores.length) writeScores(remaining);
    res.writeHead(204, { 'Cache-Control': 'no-store' });
    res.end();
    return;
  }

  if (req.method === 'GET' && pathname === '/leaderboard') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(leaderboardHtml);
    return;
  }

  if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
    try {
      const html = fs.readFileSync(GAME_FILE);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(html);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Could not read index.html. Keep index.html beside server.js.');
    }
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`DON.EXE is running at http://localhost:${PORT}`);
  console.log(`Leaderboard: http://localhost:${PORT}/leaderboard`);
});
