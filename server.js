const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const HTTPS_PORT = 8443;
const PFX_PATH = path.join(__dirname, 'certs', 'dev.pfx');
const PFX_PASS = 'trainerexpert';

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.md': 'text/markdown',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.cer': 'application/pkix-cert',
  '.pfx': 'application/x-pkcs12'
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

async function handleRequest(req, res) {
  const urlPath = (req.url || '/').split('?')[0];

  if (urlPath === '/api/shutdown' && req.method === 'POST') {
    sendJson(res, 200, { status: 'stopping' });
    console.log('Apagando servidor Node (la pestaña se cierra desde el cliente)...');
    // Delay so the HTTP response reaches the browser before exit
    setTimeout(() => process.exit(0), 150);
    return;
  }

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
}

const httpServer = http.createServer(handleRequest);
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`HTTP  http://localhost:${PORT}`);
  console.log(`HTTP  http://<tu-IP>:${PORT}  (sin micrófono en móvil)`);
});

if (fs.existsSync(PFX_PATH)) {
  const httpsServer = https.createServer(
    { pfx: fs.readFileSync(PFX_PATH), passphrase: PFX_PASS },
    handleRequest
  );
  httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log(`HTTPS https://localhost:${HTTPS_PORT}`);
    console.log(`HTTPS https://<tu-IP>:${HTTPS_PORT}  ← usa esta URL en el móvil para el mic`);
    console.log(`      (Chrome: Avanzado → Continuar al sitio)`);
  });
} else {
  console.log('');
  console.log('Sin certificado HTTPS. En el móvil el micrófono NO funcionará por HTTP.');
  console.log('Genera el cert:  powershell -ExecutionPolicy Bypass -File .\\scripts\\generate-certs.ps1');
  console.log('Luego reinicia node server.js y abre https://<IP>:8443');
}
