import { Agent } from "./src/agent/agent.js";
import { MockLLMAdapter } from "./src/llm/mock.js";
const cases = [
    "Analiza la solicitud co-industrias-delta",
    "Analiza la solicitud ec-corp-andina",
    "Analiza la solicitud hn-agroexport-sula",
    "Analiza la solicitud pa-logistica-istmo",
    "Analiza la solicitud caso-exitoso",
];
const agent = new Agent(new MockLLMAdapter());
for (const request of cases) {
    console.log("\n==================================================");
    console.log(request);
    console.log("==================================================");
    const messages = await agent.run(`demo-${request}`, request);
    for (const message of messages) {
        if (message.role === "assistant") {
            console.log(`\nAGENTE: ${message.content}`);
            if (message.toolCall) {
                console.log(`TOOL: ${message.toolCall.name}`);
            }
        }
    }
}
