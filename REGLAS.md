# Reglas del proyecto

Guía para quien contribuya (humano o asistente de IA) a TrainerExpert.

## Comunicación

- Frases cortas. Máximo 8–10 palabras por bullet si aplica.
- Sin rodeos ni preámbulos.
- Sin emojis ni guiones largos en docs/commits salvo que se pida.

## Git y secretos

- **Nunca** commitear sin petición expresa del mantenedor.
- **Nunca** subir `.env`, `candidate.md`, `interviewer.md`, `handbooks/` (salvo `handbook.example.md`), ni `certs/`.
- Usar siempre los archivos `*.example.*` como plantilla en el repo; los datos reales van en copias locales gitignored.

## Código

- Diff mínimo: reutilizar patrones existentes en `app.js` y `server.js`.
- Sin dependencias nuevas si el estándar o Node ya cubren el caso.

## IA y proveedores

- Las claves viven en `.env` o en el input manual del panel; no hardcodear.
- Cambios de modelo o proveedor: actualizar `PROVIDER_CONFIG` en `app.js` y la tabla del README.

## Documentación

- Cualquier variable de entorno nueva → `.env.example` + README.
