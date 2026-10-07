import { config } from "../config.js";
import { LLMAdapter } from "../llm/adapter.js";
import { LLMMessage } from "../types.js";
import { executeTool, providerTools } from "../tools/proveedor.js";
import { writeJsonl } from "../utils.js";

const LOG_FILE = "out/log.jsonl";

export class Agent {
  constructor(private readonly llm: LLMAdapter) {}

  async run(sessionId: string, userMessage: string, history: LLMMessage[] = []): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = [
      ...history,
      { role: "user", content: userMessage },
    ];

    for (let iteration = 1; iteration <= config.MAX_AGENT_ITERATIONS; iteration += 1) {
      const response = await this.llm.chat(messages, providerTools);
      messages.push(response.message);

      await writeJsonl(LOG_FILE, {
        timestamp: new Date().toISOString(),
        sessionId,
        iteration,
        type: "llm",
        message: response.message,
      });

      if (response.done || !response.toolCall) {
        return messages;
      }

      const toolResult = await executeTool(
        response.toolCall.name,
        response.toolCall.args,
      );

      messages.push({
        role: "tool",
        content: `Resultado de ${response.toolCall.name}`,
        toolResult,
      });

      await writeJsonl(LOG_FILE, {
        timestamp: new Date().toISOString(),
        sessionId,
        iteration,
        type: "tool",
        tool: response.toolCall.name,
        args: response.toolCall.args,
        result: JSON.parse(toolResult) as unknown,
      });
    }

    messages.push({
      role: "assistant",
      content: "El agente alcanzó el límite máximo de iteraciones y detuvo el procesamiento de forma segura.",
    });

    return messages;
  }
}