# Handbook de preparación (ejemplo)

Guía genérica para practicar entrevistas técnicas orales. **No memorices respuestas: entrena el razonamiento.**

## Qué evalúa una entrevista técnica oral

- Analizar el problema antes de proponer soluciones.
- Explicar trade-offs (qué ganas y qué sacrificas).
- Elegir la solución adecuada al contexto, no la más sofisticada.
- Pensar en voz alta: proceso, no solo resultado.

## Dominio de ejemplo: e-commerce / SaaS

Producto B2B con pedidos, inventario, informes y catálogo de productos.

### Casos típicos

1. **Pedidos** — estados, pagos, idempotencia, reintentos.
2. **Stock** — reservas, concurrencia, bloqueos optimistas/pesimistas.
3. **Informes pesados** — colas, workers, polling de estado, S3.
4. **Importación masiva** — CSV por chunks, validación parcial, progreso.

## Preguntas de profundización habituales

- ¿Cómo escala si el volumen se multiplica por 10?
- ¿Qué pasa si el worker falla a mitad de proceso?
- ¿Cómo evitas procesar el mismo job dos veces?
- ¿Qué métricas y alertas pondrías en producción?

## Stack de referencia (ajústalo a tu caso)

Backend, frontend SPA, base relacional, caché, cola de mensajes, almacenamiento de objetos.
