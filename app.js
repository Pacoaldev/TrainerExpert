import { techDrills, defaultScenarios } from './scenarios.js';
import { GoogleGenerativeAI } from 'https://esm.run/@google/generative-ai';

// State variables
let activeHandbookContent = '';
let activeHandbookName = 'Ninguno';
let geminiApiKey = localStorage.getItem('trainer_expert_api_key') || '';
let activeTab = 'dashboard';
let chatSession = null;
let currentDrillIndex = 0;

// DOM Elements
const apiKeyInput = document.getElementById('apiKey');
const handbookUpload = document.getElementById('handbookUpload');
const activeHandbookTitle = document.getElementById('activeHandbookTitle');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const scenariosList = document.getElementById('scenariosList');
const endInterviewBtn = document.getElementById('endInterviewBtn');

// Initialize settings
if (geminiApiKey) {
  apiKeyInput.value = geminiApiKey;
}

// PDF.js worker setup
if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
}

const candidateProfileInput = document.getElementById('candidateProfile');
const interviewerProfileInput = document.getElementById('interviewerProfile');

candidateProfileInput.value = localStorage.getItem('trainer_expert_candidate_profile') || '';
interviewerProfileInput.value = localStorage.getItem('trainer_expert_interviewer_profile') || '';

candidateProfileInput.addEventListener('input', (e) => {
  localStorage.setItem('trainer_expert_candidate_profile', e.target.value);
});

interviewerProfileInput.addEventListener('input', (e) => {
  localStorage.setItem('trainer_expert_interviewer_profile', e.target.value);
  const name = e.target.value.split(',')[0] || 'Entrevistador';
  document.getElementById('interviewerRole').textContent = name;
});

const handbookPathInput = document.getElementById('handbookPath');
const loadHandbookPathBtn = document.getElementById('loadHandbookPathBtn');

loadHandbookPathBtn.addEventListener('click', async () => {
  const filename = handbookPathInput.value.trim();
  if (!filename) return;
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

// Load default handbook
async function loadDefaultHandbook() {
  try {
    const response = await fetch('./handbooks/default.md');
    if (response.ok) {
      activeHandbookContent = await response.text();
      activeHandbookName = 'default.md';
      activeHandbookTitle.textContent = 'default.md';
      console.log('Default handbook loaded successfully.');
    } else {
      activeHandbookContent = 'Por favor, añade un archivo a /handbooks/default.md o cárgalo para comenzar.';
    }
  } catch (e) {
    console.error('Error loading default handbook:', e);
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
  updateUI();
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

// AI Interview Logic
async function startInterview(scenarioName = '') {
  if (!geminiApiKey) {
    alert('Introduce tu Gemini API Key en la configuración antes de empezar.');
    return;
  }

  // Switch to interview tab
  document.querySelector('[data-tab="interview"]').click();
  chatMessages.innerHTML = `<div class="message assistant"><div class="message-bubble">Iniciando simulación con el Tech Lead...</div></div>`;
  endInterviewBtn.style.display = 'block';

  const candidateProfile = candidateProfileInput.value.trim();
  const interviewerProfile = interviewerProfileInput.value.trim();

  const systemPrompt = `
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

  try {
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: systemPrompt
    });

    chatSession = model.startChat({ history: [] });
    
    // Initial prompt
    const response = await chatSession.sendMessage('Hola, estoy listo para iniciar la entrevista.');
    chatMessages.innerHTML = '';
    appendMessage('assistant', response.response.text());
    
    chatInput.disabled = false;
    sendBtn.disabled = false;
  } catch (error) {
    chatMessages.innerHTML = `<div class="message assistant"><div class="message-bubble text-danger">Error: ${error.message}</div></div>`;
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

  // Show loading indicator
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'message assistant loading-indicator';
  loadingDiv.innerHTML = `<div class="message-bubble">Escribiendo respuesta...</div>`;
  chatMessages.appendChild(loadingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  try {
    const response = await chatSession.sendMessage(text);
    loadingDiv.remove();
    appendMessage('assistant', response.response.text());
  } catch (error) {
    loadingDiv.remove();
    appendMessage('assistant', `Error: ${error.message}`);
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
  try {
    const response = await chatSession.sendMessage('Quiero terminar la entrevista. Hazme un resumen detallado de mi desempeño con puntos fuertes, áreas de mejora y una calificación estimada.');
    appendMessage('assistant', response.response.text());
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
    // Move to next drill after some time or add button
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
  if (geminiApiKey) {
    chatInput.disabled = false;
    sendBtn.disabled = false;
  } else {
    chatInput.disabled = true;
    sendBtn.disabled = true;
  }
}

// Initial setup
loadDefaultHandbook();
renderScenarios();
loadDrill();
