import { LLMMessage, LLMResponse } from "../types.js";
import { ToolDefinition } from "../tools/proveedor.js";

export interface LLMAdapter {
  chat(
    messages: LLMMessage[],
    tools: ToolDefinition[],
  ): Promise<LLMResponse>;
}