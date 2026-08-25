const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 8080;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const OPENAI_TARGETS = {
  nvidia: 'https://integrate.api.nvidia.com/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions'
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

async function proxyOpenAICompatible(res, provider, body) {
  const target = OPENAI_TARGETS[provider];
  if (!target) {
    sendJson(res, 400, { error: `Provider no soportado para proxy OpenAI: ${provider}` });
    return;
  }
  if (!body.key) {
    sendJson(res, 400, { error: 'Falta API key' });
    return;
  }

  const upstream = await fetch(target, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${body.key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      model: body.model,
      messages: body.messages,
      temperature: body.temperature ?? 0.7,
      max_tokens: body.max_tokens ?? 2048,
      stream: false
    })
  });

  const text = await upstream.text();
  res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
  res.end(text);
}

async function proxyGemini(res, body) {
  if (!body.key) {
    sendJson(res, 400, { error: 'Falta API key' });
    return;
  }
  const model = body.model || 'gemini-3.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(body.key)}`;

  const upstream = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: body.systemInstruction,
      contents: body.contents,
      generationConfig: body.generationConfig || { temperature: 0.7, maxOutputTokens: 2048 }
    })
  });

  const text = await upstream.text();
  res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
  res.end(text);
}

const server = http.createServer(async (req, res) => {
  const urlPath = (req.url || '/').split('?')[0];

  if (urlPath === '/api/shutdown' && req.method === 'POST') {
    sendJson(res, 200, { status: 'stopping' });
    console.log('Cerrando servidor y navegador...');
    exec('taskkill /F /IM comet.exe', () => process.exit(0));
    return;
  }

  // Proxy for providers that block browser CORS (NVIDIA) and keep Gemini consistent
  if (urlPath === '/api/proxy/chat' && req.method === 'POST') {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const provider = body.provider;

      if (provider === 'gemini') {
        await proxyGemini(res, body);
        return;
      }
      if (provider === 'nvidia' || provider === 'openrouter') {
        await proxyOpenAICompatible(res, provider, body);
        return;
      }
      sendJson(res, 400, { error: `Provider desconocido: ${provider}` });
    } catch (err) {
      console.error('Proxy error:', err);
      sendJson(res, 502, { error: err.message || 'Proxy falló' });
    }
    return;
  }

  let filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath);

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`TrainerExpert running at http://localhost:${PORT}`);
});
