// Three tiny local helpers for development. Point agent ENS records at them and run the
// router with ALLOW_LOCALHOST_ENDPOINTS=true. Contract: POST {"question"} -> {"answer"}.
import { createServer } from "node:http";

const helpers = [
  { port: 4001, label: "Contracts helper", reply: "Per the standard NDA template, clause 4 limits disclosure to 24 months." },
  { port: 4002, label: "Brand copy helper", reply: "Try: 'Built slowly. Made to last.' as a tagline." },
  { port: 4003, label: "Invoice helper", reply: "Invoice #1042 is 14 days overdue; a reminder was sent today." },
];

for (const h of helpers) {
  createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      let question = "";
      try { question = String(JSON.parse(body).question ?? ""); } catch { /* ignore */ }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ answer: `[${h.label}] ${h.reply}\n(You asked: ${question.slice(0, 120)})` }));
    });
  }).listen(h.port, () => console.log(`${h.label}: http://localhost:${h.port}`));
}
