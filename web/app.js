let sessionId = null;

const chat = document.querySelector("#chat");
const form = document.querySelector("#form");
const input = document.querySelector("#message");

function add(role, text) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

async function send(message) {
  add("user", message);
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({sessionId, message})
  });
  const payload = await response.json();
  if (!payload.ok) {
    add("agent", payload.error);
    return;
  }
  sessionId = payload.data.sessionId;
  const messages = payload.data.allMessages ?? [];
  for (const item of messages.slice(-8)) {
    if (item.role === "assistant" && item.toolCall) {
      add("tool", `Herramienta: ${item.toolCall.name}`);
    } else if (item.role === "tool") {
      add("tool", item.content);
    } else if (item.role === "assistant") {
      add("agent", item.content);
    }
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const value = input.value.trim();
  if (!value) return;
  input.value = "";
  await send(value);
});

document.querySelectorAll("[data-case]").forEach((button) => {
  button.addEventListener("click", async () => {
    const id = button.dataset.case;
    if (id) await send(`Analiza la solicitud ${id}`);
  });
});