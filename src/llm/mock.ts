
import { LLMAdapter } from "./adapter.js";
import { LLMMessage, LLMResponse } from "../types.js";
import { ToolDefinition } from "../tools/proveedor.js";

function lastUserContent(messages: LLMMessage[]): string {
  return [...messages]
    .reverse()
    .find((message) => message.role === "user")
    ?.content ?? "";
}

function latestToolResult(messages: LLMMessage[]): string {
  return [...messages]
    .reverse()
    .find((message) => message.role === "tool")
    ?.toolResult ?? "";
}

function extractSolicitudId(user: string, lastTool: string): string {
  const idMatch =
    user.match(/(?:solicitud|cliente|caso)\s*[:=]?\s*([a-z0-9-]+)/i) ??
    lastTool.match(/"solicitud_id"\s*:\s*"([^"]+)"/);

  return idMatch?.[1] ?? "co-industrias-delta";
}

function extractFormato(lastTool: string): "xlsx" | "pdf" | "portal" {
  const formatMatch = lastTool.match(/"formato"\s*:\s*"(xlsx|pdf|portal)"/);

  return (formatMatch?.[1] ?? "xlsx") as "xlsx" | "pdf" | "portal";
}

function packageIsReady(toolResult: string): boolean {
  return /"listo_para_firma"\s*:\s*true/i.test(toolResult);
}

function extractBlockers(toolResult: string): string[] {
  const match = toolResult.match(
    /"motivo_bloqueo"\s*:\s*\[([\s\S]*?)\]/,
  );

  if (!match?.[1]) {
    return [];
  }

  return [...match[1].matchAll(/"([^"]+)"/g)]
    .map((item) => item[1])
    .filter((item): item is string => item !== undefined);
}

function userExplicitlyConfirmed(user: string): boolean {
  return /\b(confirmo|confirmado|sí,\s*confirmo|si,\s*confirmo|autorizo|proceda|enviar)\b/i.test(
    user,
  );
}

export class MockLLMAdapter implements LLMAdapter {
  async chat(
    messages: LLMMessage[],
    _tools: ToolDefinition[],
  ): Promise<LLMResponse> {
    const user = lastUserContent(messages);
    const lastTool = latestToolResult(messages);

    const solicitudId = extractSolicitudId(user, lastTool);

    const toolCalls = messages.filter(
      (message) => message.toolCall,
    );

    const already = new Set(
      toolCalls.map((message) => message.toolCall?.name),
    );

    /*
     * 1. Leer solicitud
     */
    if (!already.has("proveedor_leer_solicitud")) {
      return {
        done: false,
        message: {
          role: "assistant",
          content: "Voy a leer la solicitud y su plantilla.",
          toolCall: {
            name: "proveedor_leer_solicitud",
            args: {
              solicitud_id: solicitudId,
            },
          },
        },
        toolCall: {
          name: "proveedor_leer_solicitud",
          args: {
            solicitud_id: solicitudId,
          },
        },
      };
    }

    /*
     * 2. Mapear campos
     */
    if (!already.has("proveedor_mapear_campos")) {
      return {
        done: false,
        message: {
          role: "assistant",
          content:
            "Ahora mapearé los campos contra el maestro y el glosario, sin inventar información.",
          toolCall: {
            name: "proveedor_mapear_campos",
            args: {
              solicitud_id: solicitudId,
            },
          },
        },
        toolCall: {
          name: "proveedor_mapear_campos",
          args: {
            solicitud_id: solicitudId,
          },
        },
      };
    }

    /*
     * 3. Validar paquete
     *
     * Esta herramienta es la fuente de verdad para:
     * - campos obligatorios
     * - soportes obligatorios
     * - vigencia
     * - confirmaciones pendientes
     */
    if (!already.has("proveedor_armar_paquete")) {
      return {
        done: false,
        message: {
          role: "assistant",
          content:
            "Validaré los campos obligatorios y los soportes exigidos antes de generar el formulario final.",
          toolCall: {
            name: "proveedor_armar_paquete",
            args: {
              solicitud_id: solicitudId,
            },
          },
        },
        toolCall: {
          name: "proveedor_armar_paquete",
          args: {
            solicitud_id: solicitudId,
          },
        },
      };
    }

    /*
     * 4. Si la validación encontró bloqueos,
     *    no continuamos con la generación del formulario.
     */
    if (
    already.has("proveedor_armar_paquete") &&
    !already.has("proveedor_generar_formulario") &&
    !packageIsReady(lastTool)
  ) {
      const blockers = extractBlockers(lastTool);

      const blockerText =
        blockers.length > 0
          ? blockers.map((item) => `- ${item}`).join("\n")
          : "- Existen campos o soportes pendientes de resolver.";

      return {
        done: true,
        message: {
          role: "assistant",
          content:
            `La validación de ${solicitudId} terminó con bloqueos.\n\n` +
            `No generaré el formulario como listo para firma ni realizaré ningún envío.\n\n` +
            `Bloqueos encontrados:\n${blockerText}\n\n` +
            `Herramientas ejecutadas:\n` +
            `- proveedor_leer_solicitud\n` +
            `- proveedor_mapear_campos\n` +
            `- proveedor_armar_paquete`,
        },
      };
    }

    /*
     * 5. Si todo está correcto, generar formulario.
     */
    if (!already.has("proveedor_generar_formulario")) {
      const formato = extractFormato(lastTool);

      return {
        done: false,
        message: {
          role: "assistant",
          content:
            `La validación no encontró bloqueos. Generaré el formulario en formato ${formato}.`,
          toolCall: {
            name: "proveedor_generar_formulario",
            args: {
              solicitud_id: solicitudId,
              formato,
            },
          },
        },
        toolCall: {
          name: "proveedor_generar_formulario",
          args: {
            solicitud_id: solicitudId,
            formato,
          },
        },
      };
    }

    /*
     * 6. No se realiza ningún envío sin confirmación explícita.
     *
     * En el demo actual, después de generar el formulario
     * se detiene el flujo y se solicita confirmación.
     */
    if (!userExplicitlyConfirmed(user)) {
      return {
        done: true,
        message: {
          role: "assistant",
          content:
            `El paquete de ${solicitudId} está listo para firma.\n\n` +
            `El formulario fue generado correctamente.\n\n` +
            `No realizaré ningún envío todavía. ` +
            `Para continuar con el envío simulado debe existir una confirmación explícita del usuario.\n\n` +
            `Herramientas ejecutadas:\n` +
            `- proveedor_leer_solicitud\n` +
            `- proveedor_mapear_campos\n` +
            `- proveedor_armar_paquete\n` +
            `- proveedor_generar_formulario`,
        },
      };
    }

    /*
     * 7. Confirmación explícita → envío simulado.
     */
    if (!already.has("proveedor_simular_envio")) {
      return {
        done: false,
        message: {
          role: "assistant",
          content:
            "Recibí la confirmación explícita. Ejecutaré únicamente el envío simulado.",
          toolCall: {
            name: "proveedor_simular_envio",
            args: {
              solicitud_id: solicitudId,
              confirmado: true,
            },
          },
        },
        toolCall: {
          name: "proveedor_simular_envio",
          args: {
            solicitud_id: solicitudId,
            confirmado: true,
          },
        },
      };
    }

    /*
     * 8. Finalizar después del envío simulado.
     */
    return {
      done: true,
      message: {
        role: "assistant",
        content:
          `Proceso terminado para ${solicitudId}.\n\n` +
          `El envío fue ejecutado únicamente en modo simulado. ` +
          `No se realizó ninguna comunicación externa real.`,
      },
    };
  }
}
