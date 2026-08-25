<p align="center">
  <img src="logo.png" alt="TrainerExpert" width="250" />
</p>

# TrainerExpert

TrainerExpert es una aplicación interactiva diseñada para simular entrevistas técnicas. Permite a los usuarios practicar y evaluar sus habilidades de resolución de problemas con un entrevistador virtual impulsado por inteligencia artificial.

## Características Principales

- **Perfiles Personalizables**: Configura dinámicamente la descripción del candidato y el estilo del entrevistador.
- **Carga de Manuales (Handbooks)**: Sube guías o documentación técnica en formato PDF o Markdown para contextualizar las respuestas.
- **Casos Prácticos**: Elige entre múltiples escenarios predefinidos para iniciar simulaciones guiadas.
- **Soporte Multi-Proveedor**: Configuración de claves API para servicios como Gemini, OpenRouter y NVIDIA.
- **Interfaz Fluida**: Diseñada con CSS moderno, modo oscuro y visualización limpia de mensajes.

## Cómo Utilizar la Aplicación

1. **Configuración de API**:
   - Introduce tu clave de API en la pestaña de ajustes.
   - Selecciona el proveedor de servicios (OpenRouter, Gemini, NVIDIA).

2. **Definir Perfiles**:
   - Ajusta los perfiles del candidato y del entrevistador en sus respectivos campos de texto.
   - Estos archivos se guardan en el almacenamiento local del navegador (`localStorage`).

3. **Subir Documentación**:
   - Carga el manual técnico de referencia para que la IA base sus preguntas en dicho material.

4. **Iniciar Simulación**:
   - Ve al panel de control.
   - Selecciona un escenario práctico de la lista e inicia el simulacro de entrevista.