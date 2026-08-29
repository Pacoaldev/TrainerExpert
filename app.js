import { techDrills, defaultScenarios } from './scenarios.js';
import { marked } from 'https://esm.run/marked';

const PROVIDER_CONFIG = {
  openrouter: {
    label: 'OpenRouter',
    envPrefix: 'OPENROUTER_API_KEYS=',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'openrouter/free',
    storageKey: 'trainer_expert_api_key_openrouter',
    useProxy: false
  },
  nvidia: {
    label: 'NVIDIA NIM',
    envPrefix: 'NVIDIA_API_KEYS=',
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    model: 'meta/llama-3.1-8b-instruct',
    storageKey: 'trainer_expert_api_key_nvidia',
    useProxy: true
  },
  gemini: {
    label: 'Gemini',
    envPrefix: 'GEMINI_API_KEYS=',
    model: 'gemini-3.5-flash',
    storageKey: 'trainer_expert_api_key_gemini',
    useProxy: true
  }
};

const HANDBOOK_PROMPT_MAX = 45000;

// State variables
let activeHandbookContent = '';
let activeHandbookName = 'Ninguno';
let apiKeys = [];
let currentKeyIndex = 0;
let activeProvider = localStorage.getItem('trainer_expert_api_provider') || 'openrouter';
let activeTab = 'dashboard';
let chatSession = null;
let chatHistory = [];
let currentDrillIndex = 0;
let activeSystemPrompt = '';
let activeScenarioName = '';

const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;
let baseTextBeforeDictation = '';

function getManualKey(provider = activeProvider) {
  const cfg = PROVIDER_CONFIG[provider];
  return localStorage.getItem(cfg.storageKey)
    || (provider === 'openrouter' ? (localStorage.getItem('trainer_expert_api_key') || '') : '');
}

function setManualKey(value, provider = activeProvider) {
  localStorage.setItem(PROVIDER_CONFIG[provider].storageKey, value);
  if (provider === 'openrouter') {
    localStorage.setItem('trainer_expert_api_key', value);
  }
}

// DOM Elements
const apiProviderSelect = document.getElementById('apiProvider');
const apiKeyInput = document.getElementById('apiKey');
const handbookUpload = document.getElementById('handbookUpload');
const activeHandbookTitle = document.getElementById('activeHandbookTitle');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const micBtn = document.getElementById('micBtn');
const scenariosList = document.getElementById('scenariosList');
const endInterviewBtn = document.getElementById('endInterviewBtn');
const candidateProfileInput = document.getElementById('candidateProfile');
const interviewerProfileInput = document.getElementById('interviewerProfile');
const handbookPathInput = document.getElementById('handbookPath');
const loadHandbookPathBtn = document.getElementById('loadHandbookPathBtn');
const shutdownBtn = document.getElementById('shutdownBtn');

shutdownBtn.addEventListener('click', () => {
  if (!confirm('¿Cerrar TrainerExpert?\nSe detendrá el servidor y podrás cerrar solo esta pestaña (no el navegador entero).')) {
    return;
  }

  let done = false;
  const showClosedScreen = () => {
    if (done) return;
    done = true;
    try { window.close(); } catch (_) { /* ignore */ }
    // Most mobile browsers ignore window.close() — always show this fallback
    document.open();
    document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>TrainerExpert detenido</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0d19;color:#f3f4f6;font-family:system-ui,sans-serif;padding:2rem;text-align:center}
h1{margin:0 0 .75rem;font-size:1.4rem}p{margin:0;color:#9ca3af;line-height:1.5}</style></head><body>
<div><h1>TrainerExpert detenido</h1><p>El servidor se ha apagado.<br>Ya puedes cerrar esta pestaña manualmente.</p></div>
</body></html>`);
    document.close();
  };

  // Don't await forever: when Node exits, fetch often hangs on mobile
  const ctrl = new AbortController();
  const killTimer = setTimeout(() => ctrl.abort(), 1200);
  fetch('./api/shutdown', { method: 'POST', keepalive: true, signal: ctrl.signal })
    .catch(() => {})
    .finally(() => {
      clearTimeout(killTimer);
      showClosedScreen();
    });

  // Absolute fallback if fetch never settles
  setTimeout(showClosedScreen, 1500);
});

// Initialize settings
apiProviderSelect.value = activeProvider;
apiKeyInput.value = getManualKey();

// PDF.js worker setup
if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
}

candidateProfileInput.value = localStorage.getItem('trainer_expert_candidate_profile') || '';
interviewerProfileInput.value = localStorage.getItem('trainer_expert_interviewer_profile') || '';

candidateProfileInput.addEventListener('input', (e) => {
  localStorage.setItem('trainer_expert_candidate_profile', e.target.value);
  updateUI();
});

interviewerProfileInput.addEventListener('input', (e) => {
  localStorage.setItem('trainer_expert_interviewer_profile', e.target.value);
  updateUI();
});

apiProviderSelect.addEventListener('change', (e) => {
  activeProvider = e.target.value;
  localStorage.setItem('trainer_expert_api_provider', activeProvider);
  chatSession = null;
  chatHistory = [];
  apiKeyInput.value = getManualKey();
  loadEnvKeys();
});

async function loadEnvKeys() {
  apiKeys = [];
  const keyPrefix = PROVIDER_CONFIG[activeProvider].envPrefix;

  try {
    const response = await fetch('./.env');
    if (response.ok) {
      const text = await response.text();
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      let collecting = false;
      for (let line of lines) {
        if (line.startsWith(keyPrefix)) {
          collecting = true;
          const val = line.substring(line.indexOf('=') + 1).trim();
          if (val) {
            apiKeys = val.split(',').map(k => k.trim()).filter(k => k);
            collecting = false;
          }
          continue;
        }
        if (collecting) {
          if (line.includes('=')) {
            collecting = false;
          } else if (!line.startsWith('#')) {
            apiKeys.push(line);
          }
        }
      }
      console.log(`Cargadas ${apiKeys.length} claves API para ${activeProvider} desde .env`);
    }
  } catch (e) {
    console.log('No se pudo cargar el archivo .env automáticamente:', e);
  }

  const manual = getManualKey().trim();
  if (manual) {
    apiKeys = [manual, ...apiKeys.filter(k => k !== manual)];
  }

  currentKeyIndex = 0;
  updateUI();
}

function getActiveKey() {
  return apiKeys[currentKeyIndex] || '';
}

function rotateApiKey() {
  if (currentKeyIndex < apiKeys.length - 1) {
    currentKeyIndex++;
    console.log(`Rotando clave API a la posición ${currentKeyIndex + 1} debido a un fallo.`);
    return true;
  }
  return false;
}

// Action for manual load
loadHandbookPathBtn.addEventListener('click', async () => {
  let filename = handbookPathInput.value.trim();
  if (!filename) return;
  
  if (filename.startsWith('handbooks/')) {
    filename = filename.replace('handbooks/', '');
  }
  
  try {
    const response = await fetch(`./handbooks/${filename}`);
    if (response.ok) {
      activeHandbookContent = await response.text();
      activeHandbookName = filename;
      activeHandbookTitle.textContent = filename;
      alert(`Handbook "${filename}" cargado desde /handbooks/`);
      updateUI();
    } else {
      alert(`No se pudo encontrar el archivo "handbooks/${filename}"`);
    }
  } catch (e) {
    alert(`Error al cargar el archivo: ${e.message}`);
  }
});

// Load default profiles on start
async function loadDefaultProfiles() {
  try {
    const respC = await fetch('./candidate.md');
    if (respC.ok) {
      const text = await respC.text();
      candidateProfileInput.value = text;
      localStorage.setItem('trainer_expert_candidate_profile', text);
    }
  } catch (e) {
    console.log('No se pudo auto-cargar candidate.md');
  }

  try {
    const respI = await fetch('./interviewer.md');
    if (respI.ok) {
      const text = await respI.text();
      interviewerProfileInput.value = text;
      localStorage.setItem('trainer_expert_interviewer_profile', text);
      const name = text.split('\n')[0].replace('#', '').trim() || 'Tech Lead';
      document.getElementById('interviewerRole').textContent = name;
    }
  } catch (e) {
    console.log('No se pudo auto-cargar interviewer.md');
  }
}

// Load default handbook
async function loadDefaultHandbook() {
  const defaultFile = 'handbook.example.md';
  try {
    const response = await fetch(`./handbooks/${defaultFile}`);
    if (response.ok) {
      activeHandbookContent = await response.text();
      activeHandbookName = defaultFile;
      activeHandbookTitle.textContent = defaultFile;
      console.log('Default handbook cargado de forma correcta.');
    } else {
      activeHandbookContent = 'Añade un handbook en /handbooks/ o súbelo desde Configuración.';
    }
  } catch (e) {
    console.error('Error cargando default handbook:', e);
  }
  updateUI();
}

// Navigation logic
document.querySelectorAll('.nav-item').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    activeTab = button.dataset.tab;
    document.getElementById(activeTab).classList.add('active');
  });
});

// Settings events
apiKeyInput.addEventListener('input', (e) => {
  setManualKey(e.target.value.trim());
  loadEnvKeys();
});

handbookUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  
  if (file.name.toLowerCase().endsWith('.pdf')) {
    reader.onload = async function(evt) {
      try {
        const typedarray = new Uint8Array(evt.target.result);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map(item => item.str).join(' ') + '\n';
        }
        activeHandbookContent = text;
        activeHandbookName = file.name;
        activeHandbookTitle.textContent = file.name;
        alert(`Handbook PDF "${file.name}" cargado y procesado.`);
        updateUI();
      } catch (err) {
        alert('Error al leer PDF: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    reader.onload = function(evt) {
      activeHandbookContent = evt.target.result;
      activeHandbookName = file.name;
      activeHandbookTitle.textContent = file.name;
      alert(`Handbook "${file.name}" cargado correctamente.`);
      updateUI();
    };
    reader.readAsText(file);
  }
});

// Render scenarios on dashboard
function renderScenarios() {
  scenariosList.innerHTML = '';
  defaultScenarios.forEach(sc => {
    const div = document.createElement('div');
    div.className = 'scenario-item';
    div.innerHTML = `
      <div class="scenario-info">
        <h4>${sc.name}</h4>
        <p>${sc.desc}</p>
      </div>
      <button class="btn btn-primary start-sc-btn" data-name="${sc.name}">Iniciar</button>
    `;
    div.querySelector('.start-sc-btn').addEventListener('click', () => {
      startInterview(sc.name);
    });
    scenariosList.appendChild(div);
  });
}

function getScenarioByName(name) {
  return defaultScenarios.find(sc => sc.name === name) || null;
}

function buildSystemPrompt(scenarioName) {
  const candidateProfile = candidateProfileInput.value.trim();
  const interviewerProfile = interviewerProfileInput.value.trim();
  const scenario = getScenarioByName(scenarioName);
  const topicHint = scenario
    ? `El candidato eligió practicar alrededor de: ${scenario.caseTopic}. Úsalo como hilo conductor natural cuando toque el caso práctico (no como examen cerrado). Posibles profundizaciones (elige según lo que diga, no las leas en lista):\n${scenario.deepening.map(q => `- ${q}`).join('\n')}`
    : 'Cuando toque el caso práctico, elige un problema real del dominio del handbook (pedidos, stock, informes, importación…).';

  const handbookForPrompt = activeHandbookContent.length > HANDBOOK_PROMPT_MAX
    ? activeHandbookContent.slice(0, HANDBOOK_PROMPT_MAX) + '\n\n[...handbook truncado por límite de contexto...]'
    : activeHandbookContent;

  return `
Eres el entrevistador del perfil de abajo. Estás haciendo una entrevista técnica ORAL presencial de 45–60 minutos para un puesto de Full-Stack Engineer.

El usuario es el CANDIDATO. Tú solo hablas como entrevistador. Nunca escribas respuestas del candidato ni inventes lo que él diría.

Perfil del entrevistador (imítalo: tono, criterio, señales verdes/rojas):
===
${interviewerProfile || 'Tech Lead pragmático, directo, centrado en negocio y robustez técnica.'}
===

Perfil del candidato (conócelo para adaptar el nivel; NO lo sustituyas en el chat):
===
${candidateProfile || 'Perfil general de ingeniería full-stack.'}
===

Handbook / material de referencia (contexto de producto, dominio y casos típicos — NO es un guion que hay que recitar; es para que sepas de qué habla la empresa y qué tipo de problemas suelen salir):
===
${handbookForPrompt}
===

${topicHint}

## Qué es esta conversación

Una entrevista tech oral real: conversación de ingeniería. Cada respuesta del candidato genera tu siguiente pregunta. La primera respuesta del candidato marca el tono.

Flujo natural (no lo anuncies ni lo numeres al candidato):
- Arranque: presentación y rapport.
- Luego: experiencia técnica relevante.
- Luego: un caso práctico de diseño / razonamiento.
- Luego: profundizas ("¿Y si…?", escala, concurrencia, fallos, asincronía, trade-offs) según lo que vaya diciendo.
- Al final (solo si pide terminar o encaja): feedback breve.

## Reglas de turno

1. UNA pregunta por mensaje.
2. Reacciona en 1–2 frases a lo que acaba de decir y profundiza.
3. No evalúes en bloque hasta "Terminar y Evaluar".
4. Valoras razonamiento y trade-offs, no sintaxis de memoria.
5. Si propone tecnología de más sin justificar volumen, empuja a lo simple.
6. Recuerda el hilo; no reinicies ni repitas preguntas.

## Formato

Español, conversacional, párrafos cortos con doble salto de línea. Sin monólogos ni listas largas mientras la entrevista está en curso.
  `.trim();
}

function buildInterviewGreeting(scenarioName) {
  const interviewer = getInterviewerData(interviewerProfileInput.value);
  const scenario = getScenarioByName(scenarioName);
  const caseLine = scenario
    ? ` Más adelante hablaremos de un caso alrededor de **${scenario.caseTopic}**.`
    : '';

  return `Hola, soy **${interviewer.name}**, ${interviewer.role}. Hoy es una entrevista técnica oral para el puesto de **Full-Stack Engineer** (unos 45–60 minutos). Me interesa cómo razonas problemas reales en ${interviewer.domain}, no memorizar ${interviewer.stack}.

Empezamos como en una entrevista de verdad: cuéntame brevemente sobre ti y tu experiencia.${caseLine}

¿Te parece? Cuando quieras, preséntate.`;
}

function seedInterviewChat(greeting) {
  chatHistory = [{ role: 'assistant', content: greeting }];
}

function extractGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!parts?.length) {
    const blocked = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason;
    throw new Error(blocked ? `Gemini bloqueó la respuesta (${blocked})` : 'Gemini no devolvió texto');
  }
  return parts.map(p => p.text || '').join('');
}

function isRotatableError(error) {
  const msg = String(error?.message || error || '');
  // CORS / network / proxy down: rotating keys won't help
  if (/failed to fetch|networkerror|load failed|proxy fall/i.test(msg)) return false;
  // Auth / quota / rate-limit: try next key
  return /HTTP (401|403|429)|API_KEY|invalid|quota|resource.?exhausted/i.test(msg);
}

async function callGemini(messages, key) {
  const cfg = PROVIDER_CONFIG.gemini;
  const system = messages.find(m => m.role === 'system')?.content || '';
  const turns = messages.filter(m => m.role !== 'system');

  const contents = [];
  for (const msg of turns) {
    const role = msg.role === 'assistant' ? 'model' : 'user';
    if (!contents.length && role === 'model') continue;
    contents.push({ role, parts: [{ text: msg.content }] });
  }
  if (!contents.length) {
    contents.push({ role: 'user', parts: [{ text: 'Continúa la entrevista.' }] });
  }

  const payload = {
    provider: 'gemini',
    key,
    model: cfg.model,
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
  };

  const response = await fetch('./api/proxy/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(`Gemini HTTP ${response.status}: ${await response.text()}`);
  }
  return extractGeminiText(await response.json());
}

async function callOpenAICompatible(messages, key) {
  const cfg = PROVIDER_CONFIG[activeProvider];
  const body = {
    model: cfg.model,
    messages,
    temperature: 0.7,
    max_tokens: 2048,
    stream: false
  };

  let response;
  if (cfg.useProxy) {
    response = await fetch('./api/proxy/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: activeProvider, key, ...body })
    });
  } else {
    response = await fetch(cfg.url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(body)
    });
  }

  if (!response.ok) {
    throw new Error(`${cfg.label} HTTP ${response.status}: ${await response.text()}`);
  }
  const data = await response.json();
  if (data.error) {
    throw new Error(`${cfg.label}: ${typeof data.error === 'string' ? data.error : JSON.stringify(data.error)}`);
  }
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`${cfg.label} no devolvió contenido: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return content;
}

async function requestModelReply(historyMessages) {
  const key = getActiveKey();
  if (!key) throw new Error('No hay clave API cargada para este proveedor.');
  const messages = [
    { role: 'system', content: activeSystemPrompt },
    ...historyMessages
  ];
  if (activeProvider === 'gemini') {
    return callGemini(messages, key);
  }
  return callOpenAICompatible(messages, key);
}

function getInterviewerData(profileText) {
  const info = {
    name: 'Tech Lead',
    role: 'Backend Tech Lead',
    stack: 'backend y frontend',
    domain: 'software B2B'
  };

  if (!profileText) return info;

  const nameMatch = profileText.match(/\|\s*Nombre\s*\|\s*([^|]+)\|/i);
  if (nameMatch) {
    info.name = nameMatch[1].trim();
  } else {
    const firstLineMatch = profileText.match(/#\s*(?:Perfil de entrevistador:)?\s*(.+)/i);
    if (firstLineMatch) {
      info.name = firstLineMatch[1].trim();
    }
  }

  const roleMatch = profileText.match(/\|\s*Rol\s*\|\s*([^|]+)\|/i);
  if (roleMatch) {
    info.role = roleMatch[1].trim();
  }

  const stackMatch = profileText.match(/\|\s*Stack del equipo\s*\|\s*([^|]+)\|/i);
  if (stackMatch) {
    info.stack = stackMatch[1].split('·')[0].trim();
  }

  const domainMatch = profileText.match(/\|\s*Dominio\s*\|\s*([^|]+)\|/i);
  if (domainMatch) {
    info.domain = domainMatch[1].replace(/\*\*/g, '').trim();
  }

  return info;
}

// AI Interview Logic
async function startInterview(scenarioName = '') {
  const key = getActiveKey();
  if (!key) {
    alert(`No hay clave API para ${PROVIDER_CONFIG[activeProvider].label}. Revisa .env o introduce una clave manual.`);
    return;
  }

  if (chatSession && !scenarioName) return;

  activeScenarioName = scenarioName;
  document.querySelector('[data-tab="interview"]').click();
  chatMessages.innerHTML = `<div class="message assistant"><div class="message-bubble">Iniciando simulación con el Tech Lead...</div></div>`;
  endInterviewBtn.style.display = 'inline-flex';

  activeSystemPrompt = buildSystemPrompt(scenarioName);
  const greeting = buildInterviewGreeting(scenarioName);
  seedInterviewChat(greeting);
  chatSession = { active: true, provider: activeProvider };
  updateUI();
  chatMessages.innerHTML = '';
  appendMessage('assistant', greeting);
}

function appendMessage(role, text) {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  const htmlContent = marked.parse(text);
  div.innerHTML = `<div class="message-bubble">${htmlContent}</div>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function handleSendMessage() {
  const text = chatInput.value.trim();
  if (!text || !chatSession) return;

  stopDictation();
  chatInput.value = '';
  appendMessage('user', text);
  await sendMessageWithFallback(text);
}

async function sendMessageWithFallback(text) {
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'message assistant loading-indicator';
  loadingDiv.innerHTML = `<div class="message-bubble">Escribiendo respuesta...</div>`;
  chatMessages.appendChild(loadingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  chatHistory.push({ role: 'user', content: text });

  try {
    const replyText = await requestModelReply(chatHistory);
    loadingDiv.remove();
    chatHistory.push({ role: 'assistant', content: replyText });
    appendMessage('assistant', replyText);
  } catch (error) {
    loadingDiv.remove();
    chatHistory.pop();
    if (isRotatableError(error) && rotateApiKey()) {
      appendMessage('assistant', `[Clave ${PROVIDER_CONFIG[activeProvider].label} inválida/agotada. Probando otra...]`);
      await sendMessageWithFallback(text);
    } else {
      const hint = /failed to fetch/i.test(String(error.message))
        ? ' (¿Servidor reiniciado? NVIDIA necesita el proxy local en server.js)'
        : '';
      appendMessage('assistant', `Error (${PROVIDER_CONFIG[activeProvider].label}): ${error.message}${hint}`);
    }
  }
}

sendBtn.addEventListener('click', handleSendMessage);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
  }
});

endInterviewBtn.addEventListener('click', async () => {
  if (!chatSession) return;
  appendMessage('assistant', 'Analizando desempeño final de la entrevista...');

  const interviewer = getInterviewerData(interviewerProfileInput.value);
  const text = `Quiero terminar la entrevista. Eres ${interviewer.name} evaluando a un candidato a Full-Stack Engineer. Hazme un resumen de mi desempeño: puntos fuertes, áreas de mejora y una señal clara (sí / no / dudoso), sin rodeos.`;
  chatHistory.push({ role: 'user', content: text });

  try {
    const replyText = await requestModelReply(chatHistory);
    appendMessage('assistant', replyText);
    endInterviewBtn.style.display = 'none';
    chatInput.disabled = true;
    sendBtn.disabled = true;
  } catch (error) {
    chatHistory.pop();
    appendMessage('assistant', `Error al evaluar (${PROVIDER_CONFIG[activeProvider].label}): ${error.message}`);
  }
});

// Technical Drills Logic
function loadDrill() {
  const drill = techDrills[currentDrillIndex];
  document.getElementById('drillTitle').textContent = drill.title;
  document.getElementById('drillDescription').textContent = drill.description;
  document.getElementById('drillCode').textContent = drill.code;
  document.getElementById('techFeedback').style.display = 'none';
  document.getElementById('techAnswer').value = '';
}

document.getElementById('checkTechAnswerBtn').addEventListener('click', () => {
  const userAns = document.getElementById('techAnswer').value.toLowerCase();
  const drill = techDrills[currentDrillIndex];
  const feedbackEl = document.getElementById('techFeedback');

  // ponytail: keyword OR-match is enough for practice drills; upgrade to LLM grading if false positives annoy
  const correct = drill.expectedKeywords.some(kw => userAns.includes(kw.toLowerCase()));
  if (correct) {
    feedbackEl.className = 'tech-feedback success';
    feedbackEl.innerHTML = `<strong>¡Excelente!</strong> Tu respuesta contiene los conceptos clave esperados: ${drill.expectedKeywords.join(', ')}.<br><br><strong>Solución propuesta:</strong><br><pre><code>${drill.solution}</code></pre>`;
    if (currentDrillIndex < techDrills.length - 1) {
      currentDrillIndex++;
      setTimeout(loadDrill, 5000);
    }
  } else {
    feedbackEl.className = 'tech-feedback error';
    feedbackEl.innerHTML = `<strong>Inténtalo de nuevo.</strong> Asegúrate de considerar conceptos como: ${drill.expectedKeywords.join(', ')}.`;
  }
  feedbackEl.style.display = 'block';
});

// Update UI States
function updateUI() {
  const key = getActiveKey();
  
  // API Keys Status
  const apiKeyHelp = document.getElementById('apiKeyHelp');
  if (apiKeys.length > 0) {
    apiKeyHelp.textContent = `API ${PROVIDER_CONFIG[activeProvider].label}: ${apiKeys.length} clave(s) disponibles (.env / manual)`;
    apiKeyHelp.style.color = 'var(--success)';
  } else {
    apiKeyHelp.textContent = `Introduce una clave de ${PROVIDER_CONFIG[activeProvider].label} o añade un archivo .env`;
    apiKeyHelp.style.color = 'var(--text-secondary)';
  }

  // Handbook Active States
  activeHandbookTitle.textContent = activeHandbookName !== 'Ninguno' ? activeHandbookName : 'Sin Cargar';
  document.getElementById('uploadedFileName').textContent = activeHandbookName;

  // Profiles Status
  const candidateStatus = document.getElementById('candidateProfileStatus');
  if (candidateProfileInput.value.trim()) {
    candidateStatus.textContent = '● Perfil activo (candidate.md)';
    candidateStatus.style.color = 'var(--success)';
  } else {
    candidateStatus.textContent = 'No cargado';
    candidateStatus.style.color = 'var(--text-secondary)';
  }

  const interviewerStatus = document.getElementById('interviewerProfileStatus');
  if (interviewerProfileInput.value.trim()) {
    const lines = interviewerProfileInput.value.split('\n');
    const firstLine = lines.find(l => l.trim().startsWith('#')) || lines[0] || '';
    const name = firstLine.replace('#', '').replace('Perfil de entrevistador:', '').replace('Perfil del Entrevistador:', '').trim() || 'Activo';
    interviewerStatus.textContent = `● Perfil activo: ${name}`;
    interviewerStatus.style.color = 'var(--success)';
    document.getElementById('interviewerRole').textContent = name;
  } else {
    interviewerStatus.textContent = 'No cargado';
    interviewerStatus.style.color = 'var(--text-secondary)';
  }

  if (key) {
    if (chatSession) {
      chatInput.disabled = false;
      sendBtn.disabled = false;
      if (micBtn) {
        micBtn.disabled = !SpeechRecognitionCtor;
        micBtn.title = SpeechRecognitionCtor ? 'Dictar por voz' : 'Dictado no soportado en este navegador';
      }
      chatInput.placeholder = "Escribe o dicta tu respuesta pensando en voz alta...";
    } else {
      chatInput.disabled = true;
      sendBtn.disabled = true;
      if (micBtn) micBtn.disabled = true;
      chatInput.placeholder = "Selecciona un caso práctico en el Inicio para comenzar...";
    }
    const welcomeBubble = document.querySelector('#chatMessages .message.assistant:first-child .message-bubble');
    if (welcomeBubble && welcomeBubble.textContent.includes('introduce tu Gemini API Key')) {
      welcomeBubble.textContent = '¡Hola! Bienvenido. Las claves de API se han cargado correctamente. Selecciona un caso práctico en el Inicio para comenzar la entrevista.';
    }
  } else {
    chatInput.disabled = true;
    sendBtn.disabled = true;
    if (micBtn) micBtn.disabled = true;
    chatInput.placeholder = "Introduce tu API Key en la barra lateral para empezar...";
  }
}

// Sidebar toggle functionality
const sidebarEl = document.getElementById('sidebar');
const appContainerEl = document.getElementById('appContainer');
const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
const showSidebarBtn = document.getElementById('showSidebarBtn');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');

function isMobileLayout() {
  return window.matchMedia('(max-width: 768px)').matches;
}

function hideSidebar() {
  sidebarEl.classList.add('hidden');
  appContainerEl.classList.add('sidebar-hidden');
  if (showSidebarBtn) showSidebarBtn.style.display = 'flex';
}

function showSidebar() {
  sidebarEl.classList.remove('hidden');
  appContainerEl.classList.remove('sidebar-hidden');
  if (showSidebarBtn) showSidebarBtn.style.display = 'none';
}

function syncMobileChrome() {
  if (isMobileLayout()) {
    hideSidebar();
  } else if (appContainerEl.classList.contains('sidebar-hidden')) {
    if (showSidebarBtn) showSidebarBtn.style.display = 'flex';
  } else if (showSidebarBtn) {
    showSidebarBtn.style.display = 'none';
  }
}

if (toggleSidebarBtn && showSidebarBtn) {
  toggleSidebarBtn.addEventListener('click', hideSidebar);
  showSidebarBtn.addEventListener('click', showSidebar);
}

if (sidebarBackdrop) {
  sidebarBackdrop.addEventListener('click', hideSidebar);
}

document.querySelectorAll('.nav-item').forEach((button) => {
  button.addEventListener('click', () => {
    if (isMobileLayout()) hideSidebar();
  });
});

window.addEventListener('resize', syncMobileChrome);

const settingsPanel = document.getElementById('settingsPanel');
const settingsToggle = document.getElementById('settingsToggle');
if (settingsToggle && settingsPanel) {
  const collapsed = localStorage.getItem('trainer_expert_settings_collapsed') === '1';
  if (collapsed) {
    settingsPanel.classList.add('collapsed');
    settingsToggle.setAttribute('aria-expanded', 'false');
  }
  settingsToggle.addEventListener('click', () => {
    const isCollapsed = settingsPanel.classList.toggle('collapsed');
    settingsToggle.setAttribute('aria-expanded', String(!isCollapsed));
    localStorage.setItem('trainer_expert_settings_collapsed', isCollapsed ? '1' : '0');
  });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').catch((err) => {
    console.log('SW no registrado:', err);
  });
}

async function initApp() {
  await loadEnvKeys();
  await loadDefaultProfiles();
  await loadDefaultHandbook();
  renderScenarios();
  loadDrill();
  registerServiceWorker();
  syncMobileChrome();
}

function setMicListening(on) {
  isListening = on;
  if (!micBtn) return;
  micBtn.classList.toggle('listening', on);
  micBtn.setAttribute('aria-pressed', String(on));
  micBtn.title = on ? 'Detener dictado' : (SpeechRecognitionCtor ? 'Dictar por voz' : 'Dictado no soportado');
}

function stopDictation() {
  if (recognition) {
    try { recognition.stop(); } catch (_) { /* ignore */ }
  }
  setMicListening(false);
}

function micNeedsHttps() {
  // localhost HTTP is a secure context; LAN IP HTTP is not (Chrome blocks mic)
  if (window.isSecureContext) return false;
  const host = location.hostname;
  return host !== 'localhost' && host !== '127.0.0.1';
}

function micBlockedMessage() {
  const host = location.hostname || '<tu-IP>';
  return (
    'En el móvil Chrome bloquea el micrófono en HTTP.\n\n' +
    '1) En el PC deja TrainerExpert en marcha\n' +
    '2) En el móvil abre:\n   https://' + host + ':8443\n' +
    '3) Pulsa Avanzado → Continuar / Acceder al sitio\n' +
    '4) Vuelve a usar el micrófono\n\n' +
    '(El triángulo de "No seguro" es normal con certificado local.)'
  );
}

function startDictation() {
  if (!SpeechRecognitionCtor || chatInput.disabled) return;

  if (micNeedsHttps()) {
    alert(micBlockedMessage());
    return;
  }

  if (isListening) {
    stopDictation();
    return;
  }

  recognition = new SpeechRecognitionCtor();
  recognition.lang = 'es-ES';
  // continuous+rebuild from 0 duplicates hard on Chrome Android (each result often carries full text)
  recognition.continuous = !isMobileLayout();
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  baseTextBeforeDictation = chatInput.value;
  if (baseTextBeforeDictation && !/\s$/.test(baseTextBeforeDictation)) {
    baseTextBeforeDictation += ' ';
  }

  recognition.onresult = (event) => {
    let interim = '';
    // Only process new results (resultIndex). Re-scanning 0..n duplicates on mobile.
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const piece = (event.results[i][0].transcript || '').trim();
      if (!piece) continue;
      if (event.results[i].isFinal) {
        const needsSpace = baseTextBeforeDictation && !/\s$/.test(baseTextBeforeDictation);
        const candidate = (needsSpace ? ' ' : '') + piece;
        // Guard: Android sometimes re-delivers the same final
        if (!baseTextBeforeDictation.endsWith(piece)) {
          baseTextBeforeDictation += candidate;
        }
      } else {
        interim += (interim ? ' ' : '') + piece;
      }
    }
    const gap = interim && baseTextBeforeDictation && !/\s$/.test(baseTextBeforeDictation) ? ' ' : '';
    chatInput.value = baseTextBeforeDictation + gap + interim;
    chatInput.scrollTop = chatInput.scrollHeight;
  };

  recognition.onerror = (event) => {
    console.warn('Dictado error:', event.error);
    stopDictation();
    if (event.error === 'not-allowed') {
      if (micNeedsHttps()) alert(micBlockedMessage());
      else alert('Permiso de micrófono denegado. En Ajustes del sitio de Chrome, permite el micrófono para esta URL.');
    } else if (event.error === 'network') {
      alert('Dictado no disponible (error de red del reconocimiento de voz).');
    }
  };

  recognition.onend = () => {
    setMicListening(false);
  };

  try {
    recognition.start();
    setMicListening(true);
  } catch (err) {
    console.error(err);
    setMicListening(false);
  }
}

if (micBtn) {
  if (!SpeechRecognitionCtor) {
    micBtn.disabled = true;
    micBtn.title = 'Dictado no soportado en este navegador';
  }
  micBtn.addEventListener('click', startDictation);
}

initApp();
