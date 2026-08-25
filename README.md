<p align="center">
  <img src="logo.png" alt="TrainerExpert" width="250" />
</p>

# TrainerExpert

Simulador de entrevistas técnicas orales con IA (perfil entrevistador + handbook + casos). Disponible como **web** y **PWA** instalable en Android (Chrome).

## Características

- Simulación oral conversacional (entrevistador vs candidato)
- Dictado por voz → texto en el input → Enviar manual
- Casos prácticos, handbook PDF/MD, perfiles en localStorage
- Proveedores: OpenRouter, Gemini, NVIDIA (proxy local para CORS)
- PWA: añadir a pantalla de inicio desde Chrome

## Uso en escritorio

1. Arranca con `start.ps1` o `node server.js`
2. Abre `http://localhost:8080`
3. Configura proveedor/API (o `.env`)
4. En **Inicio**, elige un caso → **Simulador Oral**
5. Opcional: pulsa el micrófono, dicta, revisa el texto y **Enviar**

## PWA en el móvil (misma Wi‑Fi)

1. En el PC, deja `node server.js` en marcha (escucha en `0.0.0.0:8080`)
2. Averigua la IP local del PC (p.ej. `ipconfig` → IPv4)
3. En Chrome Android abre `http://<IP>:8080`
4. Menú → **Añadir a pantalla de inicio** / Instalar app
5. Usa la app; las API keys se pueden pegar en Configuración

### Micrófono en móvil

El dictado usa la Web Speech API (mejor en Chromium). En **HTTP a una IP de LAN**, Chrome Android a veces **bloquea el micrófono** (origen no seguro). Si falla:

- Prueba primero el dictado en el PC (Comet/Chrome)
- En móvil: HTTPS local o un túnel con TLS; o dicta en el PC

OpenRouter suele ir directo desde el navegador; NVIDIA/Gemini pasan por el proxy de `server.js` (el PC debe estar accesible).

## Apagar

El botón **Apagar Aplicación** detiene el servidor Node (y el proxy) y cierra Comet en Windows.
