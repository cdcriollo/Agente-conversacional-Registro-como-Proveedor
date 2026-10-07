# SOLUCIÓN — Reto técnico 01

## 1. Enfoque

Se implementa un agente conversacional con separación entre:
- razonamiento/orquestación del LLM;
- herramientas determinísticas;
- fixtures;
- generación de documentos;
- API y UI.

En esta primera versión se utiliza `MockLLMAdapter` para poder validar el flujo sin depender de una API externa.

## 2. Arquitectura

El agente ejecuta un ciclo máximo configurable. El LLM propone una herramienta; el backend valida y ejecuta la herramienta; el resultado vuelve al contexto.

La fuente de verdad de los datos no es el LLM. El mapeo se realiza mediante glosario, maestro y reglas de país.

## 3. Decisiones

### LLM desacoplado

Se utiliza `LLMAdapter` para permitir Gemini ahora y otros proveedores después.

### Mapeo determinístico

Evita alucinaciones de datos. Por ejemplo, RUC/RTN no se convierten automáticamente en NIT cuando el país exige un identificador diferente.

### Envío simulado

El reto exige confirmación explícita y no permite una integración real. Por eso la herramienta solamente crea `ENVIO-SIMULADO.md`.

## 4. Portal

Para un portal real se utilizaría una integración controlada mediante API si existe; en ausencia de API, podría utilizarse automatización de navegador/RPA o una extensión. Las credenciales deberían ser introducidas por una persona y nunca almacenarse en prompt, logs o repositorio. CAPTCHA/MFA deben permanecer bajo control humano.

## 5. Trade-offs

1. Memoria en RAM en lugar de base de datos: simple para el reto, pero no adecuada para alta disponibilidad.
2. Mock LLM en desarrollo: permite pruebas determinísticas, aunque no valida todavía el comportamiento de un modelo real.
3. Herramientas determinísticas: aumenta código, pero reduce el riesgo de inventar datos.
4. PDF/XLSX generados desde cero: permite demostrar el flujo, aunque una implementación productiva debería preservar una plantilla binaria oficial.

## 6. Casos cubiertos

- Colombia: soporte de Cámara de Comercio vencido.
- Ecuador: identificador extranjero y soporte tributario faltante.
- Honduras: identificador extranjero, campo faltante y soporte vencido.
- Panamá: preparación de valores para portal.

## 7. IA utilizada

Durante el desarrollo se utiliza asistencia de IA para diseño, revisión y generación inicial de código. La implementación debe ser revisada y comprendida por el autor antes de su entrega.

## 8. Riesgos

- calidad y disponibilidad del LLM;
- cambios en plantillas;
- soportes vencidos;
- credenciales y MFA de portales;
- exposición de datos sensibles;
- límites de sesión y tokens.
