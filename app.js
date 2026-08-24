import { techDrills, defaultScenarios } from './scenarios.js';
import { GoogleGenerativeAI } from 'https://esm.run/@google/generative-ai';

// State variables
let activeHandbookContent = '';
let activeHandbookName = 'Ninguno';
let apiKeys = [];
let currentKeyIndex = 0;
let geminiApiKey = localStorage.getItem('trainer_expert_api_key') || '';
let activeProvider = localStorage.getItem('trainer_expert_api_provider') || 'openrouter';
let activeTab = 'dashboard';
let chatSession = null;
let chatHistory = [];
let currentDrillIndex = 0;
let activeSystemPrompt = '';

// DOM Elements
const apiProviderSelect = document.getElementById('apiProvider');
const apiKeyInput = document.getElementById('apiKey');
const handbookUpload = document.getElementById('handbookUpload');
const activeHandbookTitle = document.getElementById('activeHandbookTitle');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const scenariosList = document.getElementById('scenariosList');
const endInterviewBtn = document.getElementById('endInterviewBtn');
const candidateProfileInput = document.getElementById('candidateProfile');
const interviewerProfileInput = document.getElementById('interviewerProfile');
const handbookPathInput = document.getElementById('handbookPath');
const loadHandbookPathBtn = document.getElementById('loadHandbookPathBtn');

// Initialize settings
apiProviderSelect.value = activeProvider;
if (geminiApiKey) {
  apiKeyInput.value = geminiApiKey;
}

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
  loadEnvKeys();
});

// Load API keys from .env and local storage
async function loadEnvKeys() {
  apiKeys = [];
  try {
    const response = await fetch('./.env');
    if (response.ok) {
      const text = await response.text();
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      let collecting = false;
      for (let line of lines) {
        if (line.startsWith('GEMINI_API_KEYS=')) {
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
      console.log(`Cargadas ${apiKeys.length} claves API desde .env`);
    }
  } catch (e) {
    console.log('No se pudo cargar el archivo .env automáticamente:', e);
  }
  
  if (geminiApiKey) {
    apiKeys = [geminiApiKey, ...apiKeys.filter(k => k !== geminiApiKey)];
  }
  
  currentKeyIndex = 0;
  updateUI();
  if (apiKeys.length > 0) {
    startInterview();
  }
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
  try {
    const response = await fetch('./handbooks/handbook.example.md');
    if (response.ok) {
      activeHandbookContent = await response.text();
      activeHandbookName = 'handbook.example.md';
      activeHandbookTitle.textContent = 'handbook.example.md';
      console.log('Default handbook cargado de forma correcta.');
    } else {
      activeHandbookContent = 'Por favor, añade un archivo a /handbooks/handbook.example.md o introduce uno en "Cargar desde...".';
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
  geminiApiKey = e.target.value.trim();
  localStorage.setItem('trainer_expert_api_key', geminiApiKey);
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

function buildSystemPrompt(scenarioName) {
  const candidateProfile = candidateProfileInput.value.trim();
  const interviewerProfile = interviewerProfileInput.value.trim();
  
  return `
    Eres el entrevistador principal según el perfil definido abajo y el Handbook proporcionado.
    
    Perfil del entrevistador a emular:
    ===
    ${interviewerProfile || 'Tech Lead. Pragmático, directo, centrado en el negocio y la robustez técnica.'}
    ===

    Perfil y conocimientos del Candidato (utilízalo para adaptar el nivel y las preguntas, buscando evaluar cómo traslada sus conocimientos al ecosistema del handbook):
    ===
    ${candidateProfile || 'Perfil general de ingeniería backend.'}
    ===

    Handbook técnico de referencia (toda la entrevista se rige por estos principios, casos y dinámicas):
    ===
    ${activeHandbookContent}
    ===
    
    Instrucciones de comportamiento:
    1. Debes simular una entrevista técnica realista basada en el escenario: ${scenarioName || 'general del handbook'}.
    2. No evalúes sintaxis de memoria, busca razonamiento técnico, evaluación de trade-offs y pensamiento en voz alta.
    3. Plantea problemas progresivos, y luego repregunta escalando el volumen o introduciendo fallos.
    4. Sé fiel al perfil del entrevistador especificado.
    5. Importante: Mantén tus respuestas conversacionales y cortas. Máximo 2-3 párrafos por turno para facilitar el intercambio fluido.
  `;
}

// AI Interview Logic
async function startInterview(scenarioName = '') {
  const key = getActiveKey();
  if (!key) return;

  if (chatSession && !scenarioName) return;

  document.querySelector('[data-tab="interview"]').click();
  chatMessages.innerHTML = `<div class="message assistant"><div class="message-bubble">Iniciando simulación con el Tech Lead...</div></div>`;
  endInterviewBtn.style.display = 'block';

  activeSystemPrompt = buildSystemPrompt(scenarioName);
  chatHistory = [];

  let greeting = '';
  if (scenarioName) {
    greeting = `Hola, soy Tech Lead. Vamos a iniciar el caso práctico sobre: **${scenarioName}**. ¿Cómo lo plantearías inicialmente?`;
  } else {
    greeting = `Hola, soy Tech Lead, Backend Tech Lead. Vamos a hacer una entrevista técnica de unos 45–60 minutos: me interesa cómo razonas problemas reales de backend en un producto SaaS B2B, no memorizar Laravel. Empezamos con una presentación breve de tu experiencia y después planteamos un caso. ¿Te parece?`;
  }

  if (activeProvider === 'gemini') {
    try {
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction: activeSystemPrompt
      });

      chatSession = model.startChat({ history: [] });
      updateUI();
      chatMessages.innerHTML = '';
      appendMessage('assistant', greeting);
    } catch (error) {
      if (rotateApiKey()) {
        await startInterview(scenarioName);
      } else {
        chatMessages.innerHTML = `<div class="message assistant"><div class="message-bubble text-danger">Error: ${error.message} (Todas las claves fallaron)</div></div>`;
      }
    }
  } else {
    chatSession = { active: true };
    updateUI();
    chatMessages.innerHTML = '';
    appendMessage('assistant', greeting);
  }
}

function appendMessage(role, text) {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.innerHTML = `<div class="message-bubble">${text}</div>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function handleSendMessage() {
  const text = chatInput.value.trim();
  if (!text || !chatSession) return;

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
  const key = getActiveKey();

  try {
    let replyText = '';
    
    if (activeProvider === 'gemini') {
      const response = await chatSession.sendMessage(text);
      replyText = response.response.text();
    } else if (activeProvider === 'openrouter') {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3-8b-instruct:free",
          messages: [
            { role: "system", content: activeSystemPrompt },
            ...chatHistory
          ]
        })
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      const data = await response.json();
      replyText = data.choices[0].message.content;
    } else if (activeProvider === 'nvidia') {
      const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "meta/llama3-8b-instruct",
          messages: [
            { role: "system", content: activeSystemPrompt },
            ...chatHistory
          ]
        })
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      const data = await response.json();
      replyText = data.choices[0].message.content;
    }

    loadingDiv.remove();
    chatHistory.push({ role: 'assistant', content: replyText });
    appendMessage('assistant', replyText);
  } catch (error) {
    loadingDiv.remove();
    chatHistory.pop();
    if (rotateApiKey()) {
      appendMessage('assistant', `[Rotación automática de clave API por fallo. Reintentando...]`);
      await sendMessageWithFallback(text);
    } else {
      appendMessage('assistant', `Error: ${error.message}`);
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
  
  const text = 'Quiero terminar la entrevista. Hazme un resumen detallado de mi desempeño con puntos fuertes, áreas de mejora y una calificación estimada.';
  chatHistory.push({ role: 'user', content: text });
  const key = getActiveKey();

  try {
    let replyText = '';
    
    if (activeProvider === 'gemini') {
      const response = await chatSession.sendMessage(text);
      replyText = response.response.text();
    } else {
      const url = activeProvider === 'openrouter' 
        ? "https://openrouter.ai/api/v1/chat/completions" 
        : "https://integrate.api.nvidia.com/v1/chat/completions";
      const model = activeProvider === 'openrouter' 
        ? "meta-llama/llama-3-8b-instruct:free" 
        : "meta/llama3-8b-instruct";
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: activeSystemPrompt },
            ...chatHistory
          ]
        })
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      const data = await response.json();
      replyText = data.choices[0].message.content;
    }

    appendMessage('assistant', replyText);
    endInterviewBtn.style.display = 'none';
    chatInput.disabled = true;
    sendBtn.disabled = true;
  } catch (error) {
    appendMessage('assistant', `Error al evaluar: ${error.message}`);
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

  const correct = drill.expectedKeywords.every(kw => userAns.includes(kw.toLowerCase()));
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
    apiKeyHelp.textContent = `API cargada exitosamente desde archivo .env (${apiKeys.length} claves disponibles)`;
    apiKeyHelp.style.color = 'var(--success)';
  } else if (geminiApiKey) {
    apiKeyHelp.textContent = 'API cargada manualmente';
    apiKeyHelp.style.color = 'var(--success)';
  } else {
    apiKeyHelp.textContent = 'Introduce una clave manualmente o añade un archivo .env';
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
      chatInput.placeholder = "Escribe tu respuesta pensando en voz alta...";
    } else {
      chatInput.disabled = true;
      sendBtn.disabled = true;
      chatInput.placeholder = "Selecciona un caso práctico en el Inicio para comenzar...";
    }
    const welcomeBubble = document.querySelector('#chatMessages .message.assistant:first-child .message-bubble');
    if (welcomeBubble && welcomeBubble.textContent.includes('introduce tu Gemini API Key')) {
      welcomeBubble.textContent = '¡Hola! Bienvenido. Las claves de API se han cargado correctamente. Selecciona un caso práctico en el Inicio para comenzar la entrevista.';
    }
  } else {
    chatInput.disabled = true;
    sendBtn.disabled = true;
    chatInput.placeholder = "Introduce tu Gemini API Key en la barra lateral para empezar...";
  }
}

// Initial setup
async function initApp() {
  await loadEnvKeys();
  await loadDefaultProfiles();
  await loadDefaultHandbook();
  renderScenarios();
  loadDrill();
  if (getActiveKey()) {
    startInterview();
  }
}

initApp();
