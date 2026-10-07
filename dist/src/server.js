import express from "express";
import { randomUUID } from "node:crypto";
import { Agent } from "./agent/agent.js";
import { MockLLMAdapter } from "./llm/mock.js";
import { config } from "./config.js";
import path from "node:path";
const app = express();
app.use(express.json());
app.use(express.static(path.join(process.cwd(), "web")));
const sessions = new Map();
const agent = new Agent(new MockLLMAdapter());
app.get("/api/health", (_req, res) => {
    res.json({ ok: true, llm: "mock", timestamp: new Date().toISOString() });
});
app.get("/api/sessions/:id", (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) {
        res.status(404).json({ ok: false, error: "Sesión no encontrada." });
        return;
    }
    res.json({ ok: true, data: session });
});
app.post("/api/chat", async (req, res) => {
    const body = req.body;
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
        res.status(400).json({ ok: false, error: "message es obligatorio." });
        return;
    }
    const sessionId = body.sessionId ?? randomUUID();
    const current = sessions.get(sessionId) ?? {
        id: sessionId,
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    const result = await agent.run(sessionId, message, current.messages);
    current.messages = result.slice(-config.MAX_SESSION_MESSAGES);
    current.updatedAt = new Date().toISOString();
    sessions.set(sessionId, current);
    const assistantMessages = result.filter((item) => item.role === "assistant");
    res.json({
        ok: true,
        data: {
            sessionId,
            messages: assistantMessages,
            allMessages: result,
        },
    });
});
app.listen(config.PORT, () => {
    console.log(`Reto 01 ejecutándose en http://localhost:${config.PORT}`);
});
