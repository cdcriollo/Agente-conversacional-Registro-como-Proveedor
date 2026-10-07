# Reto técnico 01 — Agente conversacional Registro como Proveedor

## Estado actual

Versión funcional y ejecutable localmente.

* TypeScript + Node.js 20+
* Express
* Zod
* ExcelJS
* PDFKit
* Mock LLM
* Herramientas determinísticas
* Sesiones en memoria
* Registro de ejecución en `out/log.jsonl`
* UI web sencilla

La integración con Gemini se realizará mediante `LLMAdapter`, sin modificar las herramientas determinísticas.

## Instalación

npm install
npm run build


## Ejecución

npm run dev


Abrir en el navegador:

`http://localhost:3000`

## Demo determinística

npm run demo

La demo procesa cinco fixtures y valida diferentes escenarios de registro de proveedores, incluyendo casos bloqueados y un caso exitoso.

## Variables

Copiar `.env.example` a `.env`.

La API Key nunca debe entrar al repositorio.

## Herramientas

1. `proveedor_leer_solicitud`
2. `proveedor_mapear_campos`
3. `proveedor_generar_formulario`
4. `proveedor_armar_paquete`
5. `proveedor_simular_envio`

## Flujo

1. Leer la solicitud y la plantilla.
2. Mapear los campos contra el glosario y el maestro.
3. Validar campos obligatorios y soportes.
4. Generar el formulario requerido cuando no existen bloqueos.
5. Solicitar confirmación explícita antes del envío.
6. Ejecutar únicamente un envío simulado, generando `ENVIO-SIMULADO.md`.

## Principio de seguridad

El LLM orquesta el flujo; las herramientas determinísticas son la fuente de verdad para datos, soportes y estados.

No se realizan envíos externos reales.
