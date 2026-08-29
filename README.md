<p align="center">
  <img src="logo.png" alt="TrainerExpert" width="250" />
</p>

# TrainerExpert

Simulador local de entrevistas técnicas con IA. Practica entrevistas orales conversacionales, casos de diseño y ejercicios técnicos cortos desde el navegador.

Sin backend propio más allá de un servidor estático en Node: tus perfiles, handbooks y claves API se quedan en tu máquina.

## Características

- **Simulador oral** — entrevista conversacional con un perfil de entrevistador configurable y contexto de handbook.
- **Casos prácticos** — escenarios de diseño (pedidos, auth, APIs, stock, reservas, pagos, etc.).
- **Simulador técnico** — drills cortos con comprobación por palabras clave.
- **Varios proveedores de IA** — OpenRouter, NVIDIA NIM y Gemini (con proxy local para evitar CORS).
- **Dictado por voz** — Web Speech API en español (`es-ES`).
- **PWA** — instalable en móvil; layout responsive con menú lateral.
- **HTTPS local** — certificado autofirmado para usar el micrófono desde el móvil en la LAN.

## Requisitos

- [Node.js](https://nodejs.org/) 18+ (usa `fetch` nativo en `server.js`)
- Windows con PowerShell (scripts `start.ps1` / `stop.ps1`; en otros SO puedes usar `node server.js` directamente)
- Clave API de al menos un proveedor soportado

## Inicio rápido

```powershell
git clone https://github.com/Pacoaldev/TrainerExpert.git
cd TrainerExpert

Copy-Item .env.example .env
Copy-Item candidate.example.md candidate.md
Copy-Item interviewer.example.md interviewer.md
```

1. Edita `.env` y añade tus claves API.
2. Opcional: personaliza `candidate.md`, `interviewer.md` y añade handbooks en `handbooks/` (parte de `handbooks/handbook.example.md`).
3. Arranca el servidor:

```powershell
.\start.ps1
```

4. Abre `http://localhost:8080`, elige un caso en **Inicio** y empieza la entrevista.

Para detener el servidor sin cerrar el navegador:

```powershell
.\stop.ps1
```

O usa **Apagar Aplicación** en la interfaz (detiene Node e intenta cerrar solo la pestaña actual).

## Configuración

### Claves API (`.env`)

| Variable | Proveedor | Notas |
|----------|-----------|--------|
| `OPENROUTER_API_KEYS` | OpenRouter | Varias claves separadas por coma o una por línea |
| `NVIDIA_API_KEYS` | NVIDIA NIM | Pasa por el proxy local (`/api/proxy/chat`) |
| `GEMINI_API_KEYS` | Google Gemini | Igual; modelo por defecto `gemini-3.5-flash` |

También puedes pegar una clave manualmente en el panel **Configuración**. Las claves del `.env` tienen prioridad; si una falla por cuota o auth, rota a la siguiente.

### Perfiles y handbook

| Archivo | Uso |
|---------|-----|
| `candidate.md` | Perfil del candidato (tú). Gitignored. |
| `interviewer.md` | Tono y criterio del entrevistador. Gitignored. |
| `handbooks/*.md` | Contexto de producto/dominio para el prompt. Gitignored salvo `handbook.example.md`. |

Los archivos `*.example.*` son plantillas de referencia; cópialos y renómbralos para tu uso local.

## Proveedores de IA

| Proveedor | Modelo por defecto | Proxy local |
|-----------|-------------------|-------------|
| OpenRouter | `openrouter/free` | No |
| NVIDIA NIM | `meta/llama-3.1-8b-instruct` | Sí |
| Gemini | `gemini-3.5-flash` | Sí |

NVIDIA y Gemini llaman a `./api/proxy/chat` en `server.js` para evitar bloqueos CORS desde el navegador.

## Micrófono en el móvil

Chrome **bloquea el micrófono** en `http://192.168.x.x`. En LAN hace falta **HTTPS**.

1. Genera el certificado (solo la primera vez):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate-certs.ps1
```

(`start.ps1` también lo genera si falta `certs/dev.pfx`.)

2. Arranca el servidor. Debe escuchar:
   - `http://localhost:8080`
   - `https://0.0.0.0:8443`

3. En el móvil (misma Wi‑Fi):

```text
https://<tu-IP>:8443
```

(`ipconfig` en Windows para ver tu IP.)

4. Acepta el aviso del certificado autofirmado (**Avanzado** → **Continuar**).
5. Permite el micrófono cuando Chrome lo pida.
6. Opcional: **Añadir a pantalla de inicio** (PWA).

Si usas `http://<tu-IP>:8080`, el micrófono no funcionará aunque des permisos en Android.

### Firewall Windows

Si no carga desde el móvil, permite Node en los puertos **8080** y **8443** (regla TCP entrante).

## Estructura del proyecto

```text
TrainerExpert/
├── app.js              # Lógica de la app (chat, perfiles, drills)
├── server.js           # Servidor estático + proxy API + shutdown
├── scenarios.js        # Casos de entrevista y drills técnicos
├── index.html / style.css
├── sw.js               # Service worker (PWA)
├── start.ps1 / stop.ps1
├── scripts/generate-certs.ps1
├── handbooks/          # Tus handbooks locales (gitignored)
├── .env.example        # Plantilla de claves
├── candidate.example.md
└── interviewer.example.md
```

## Privacidad

- `.env`, `candidate.md`, `interviewer.md` y `handbooks/` (salvo el ejemplo) están en `.gitignore`.
- Las peticiones a la IA salen desde tu navegador o el proxy local de tu PC; no hay servidor central de TrainerExpert.
- No subas claves API ni datos personales al repositorio.

## Contribuir

Revisa [REGLAS.md](REGLAS.md) antes de proponer cambios. Resumen: diff mínimo, sin secretos en git, sin commits automáticos sin acuerdo.

## Licencia

[MIT](LICENSE.md) — Copyright (c) 2026 Pacoaldev
