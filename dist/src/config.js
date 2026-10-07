import { z } from "zod";
const EnvSchema = z.object({
    PORT: z.coerce.number().int().positive().default(3000),
    MAX_AGENT_ITERATIONS: z.coerce.number().int().positive().default(25),
    MAX_SESSION_MESSAGES: z.coerce.number().int().positive().default(80),
    LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
});
export const config = EnvSchema.parse({
    PORT: process.env.PORT ?? "3000",
    MAX_AGENT_ITERATIONS: process.env.MAX_AGENT_ITERATIONS ?? "25",
    MAX_SESSION_MESSAGES: process.env.MAX_SESSION_MESSAGES ?? "80",
    LLM_TIMEOUT_MS: process.env.LLM_TIMEOUT_MS ?? "30000",
});
