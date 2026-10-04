import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadPort } from "./config.ts";
import { getAgents } from "./directory.ts";
import { LlmUnavailableError } from "./llm.ts";
import { handleQuestion } from "./pipeline.ts";

const MAX_BODY_BYTES = 4 * 1024;
const INDEX_HTML = fileURLToPath(new URL("../public/index.html", import.meta.url));

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new RangeError("Request body too large.");
    chunks.push(chunk as Buffer);
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (typeof parsed !== "object" || parsed === null) throw new SyntaxError("Expected an object.");
  return parsed as Record<string, unknown>;
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(await readFile(INDEX_HTML));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/agents") {
    const d = await getAgents();
    send(res, 200, {
      agents: d.agents.map((a) => ({ name: a.name, description: a.description, topics: a.topics, input: a.input })),
      skipped: d.skipped,
      discoveredAt: new Date(d.discoveredAt).toISOString(),
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/ask") {
    const body = await readJson(req);
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (question.length < 3 || question.length > 1000) {
      send(res, 400, { error: "Question must be 3-1000 characters." });
      return;
    }
    const outcome = await handleQuestion(question);
    send(res, outcome.status === "agent-error" ? 502 : 200, outcome);
    return;
  }

  send(res, 404, { error: "Not found." });
}

const server = createServer((req, res) => {
  handle(req, res).catch((err: unknown) => {
    if (err instanceof RangeError) return send(res, 413, { error: err.message });
    if (err instanceof SyntaxError) return send(res, 400, { error: "Invalid JSON body." });
    if (err instanceof LlmUnavailableError) return send(res, 503, { error: err.message });
    if (err instanceof DOMException && err.name === "TimeoutError") return send(res, 504, { error: "The model took too long to respond." });
    console.error(err);
    send(res, 500, { error: "Something went wrong. Check DIRECTORY_NAME and try again." });
  });
});

const port = loadPort();
server.listen(port, () => console.log(`ens-agent-router on http://localhost:${port}`));
