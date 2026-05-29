const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:7b";
const TIMEOUT_MS = 30000;

export class OllamaUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = "OllamaUnavailableError";
  }
}

export async function chat({ messages, format }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: false,
        ...(format ? { format } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new OllamaUnavailableError(`Ollama 응답 오류 (${res.status})`);
    }
    const data = await res.json();
    return data?.message?.content ?? "";
  } catch (err) {
    if (err instanceof OllamaUnavailableError) throw err;
    if (err.name === "AbortError") {
      throw new OllamaUnavailableError("Ollama 응답 시간이 초과되었습니다.");
    }
    throw new OllamaUnavailableError(`Ollama 연결에 실패했습니다: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}
