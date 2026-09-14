// lib/ollama.ts
// Thin wrapper around a local Ollama server (http://localhost:11434) for the
// one optional AI-assisted step in this app: pre-filling the /intake form's
// Property group from a pasted listing export (e.g. a REALM printout).
//
// Everything else in the app is deliberately non-AI (see mvp-build-plan.md's
// "Design decision" note) — deal-specific fields are always direct realtor
// entry, never LLM-extracted, since there's no source document for them to
// come from. This is the one place AI genuinely helps: a listing export is
// already labeled/tabular text, so an LLM just needs to reshape it into JSON.
//
// Model is hardcoded here in one place so it's a one-line swap if a faster
// local model gets pulled later (gpt-oss:20b is a reasoning model — most of
// its ~40s latency is its "thinking" step, not the actual extraction).

const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL = "gpt-oss:20b";

export async function ollamaExtractJson(prompt: string): Promise<unknown> {
  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, prompt, stream: false }),
  });

  if (!res.ok) {
    throw new Error(`Ollama request failed: ${res.status} ${await res.text()}`);
  }

  const body = await res.json();
  const raw: string = body.response ?? "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Ollama did not return JSON. Raw response: ${raw.slice(0, 200)}`);
  }
  return JSON.parse(jsonMatch[0]);
}
