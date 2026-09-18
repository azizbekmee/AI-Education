import Anthropic from "@anthropic-ai/sdk";

export function isAiEnabled() {
  return Boolean(process.env.ANTHROPIC_AUTH_TOKEN);
}

function getClient() {
  const token = process.env.ANTHROPIC_AUTH_TOKEN;
  if (!token) throw new Error("AI_NOT_CONFIGURED");
  return new Anthropic({
    authToken: token,
    baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
  });
}

function getModel() {
  return process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
}

export async function callClaude(system: string, user: string, maxTokens = 4000): Promise<string> {
  const client = getClient();
  const res = await client.messages.create({
    model: getModel(),
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("NO_JSON");
  return JSON.parse(text.slice(start, end + 1));
}
