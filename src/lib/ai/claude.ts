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

export type AiFileBlock =
  | { kind: "pdf"; name: string; base64: string }
  | { kind: "image"; name: string; mediaType: string; base64: string }
  | { kind: "text"; name: string; text: string };

/** Claude call where the uploaded files themselves are part of the message (PDF/image/text blocks). */
export async function callClaudeWithFiles(
  system: string,
  user: string,
  files: AiFileBlock[],
  maxTokens = 8000
): Promise<string> {
  const client = getClient();
  const blocks: Anthropic.ContentBlockParam[] = [];
  for (const f of files) {
    if (f.kind === "pdf") {
      blocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: f.base64 },
        title: f.name,
      });
    } else if (f.kind === "image") {
      blocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: f.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: f.base64,
        },
      });
    } else {
      blocks.push({ type: "text", text: `— ${f.name} —\n${f.text}` });
    }
  }
  blocks.push({ type: "text", text: user });
  const res = await client.messages.create({
    model: getModel(),
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: blocks }],
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
