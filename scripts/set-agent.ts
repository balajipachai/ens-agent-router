// Publish a helper's self-description (or the directory list) on an ENS name you own on Sepolia.
//   PRIVATE_KEY=0x... npm run set-agent -- invoices.eth --description "Answers invoice and payment questions" --endpoint https://invoices.example.com/ask --topics "invoices, payments"
//   PRIVATE_KEY=0x... npm run set-agent -- studio.eth --directory "contracts.eth, brand.eth, invoices.eth"
import { createPublicClient, createWalletClient, encodeFunctionData, http, parseAbi, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { namehash } from "viem/ens";
import { AGENT_KEYS, DIRECTORY_KEY, checkEndpoint } from "../src/agent.ts";
import { normalizeEnsName } from "../src/ens.ts";

const args = process.argv.slice(2);
const nameArg = args.shift();
const flags = new Map<string, string>();
for (let i = 0; i < args.length; i += 2) flags.set(args[i]!.replace(/^--/, ""), args[i + 1] ?? "");

const key = process.env.PRIVATE_KEY;
if (!nameArg || !key || flags.size === 0) {
  console.error('Usage: PRIVATE_KEY=0x... npm run set-agent -- <name.eth> [--description "..."] [--endpoint https://...] [--topics "a, b"] [--input "what it accepts"] [--directory "x.eth, y.eth"]');
  process.exit(1);
}
const endpoint = flags.get("endpoint");
if (endpoint && !checkEndpoint(endpoint, false)) {
  console.error("Refusing to publish: endpoint must be a public https URL.");
  process.exit(1);
}

const records: [string, string][] = [];
if (flags.has("description")) records.push([AGENT_KEYS.description, flags.get("description")!]);
if (endpoint) records.push([AGENT_KEYS.endpoint, endpoint]);
if (flags.has("topics")) records.push([AGENT_KEYS.topics, flags.get("topics")!]);
if (flags.has("input")) records.push([AGENT_KEYS.input, flags.get("input")!]);
if (flags.has("directory")) records.push([DIRECTORY_KEY, flags.get("directory")!]);

const name = normalizeEnsName(nameArg);
const transport = http(process.env.SEPOLIA_RPC_URL || undefined);
const pub = createPublicClient({ chain: sepolia, transport });
const wallet = createWalletClient({ chain: sepolia, transport, account: privateKeyToAccount(key as Hex) });
const abi = parseAbi([
  "function setText(bytes32 node, string key, string value)",
  "function multicall(bytes[] data) returns (bytes[] results)",
]);
const node = namehash(name);
const calls = records.map(([k, v]) => encodeFunctionData({ abi, functionName: "setText", args: [node, k, v] }));
const resolver = await pub.getEnsResolver({ name });
const hash = await wallet.writeContract({ address: resolver, abi, functionName: "multicall", args: [calls] });
console.log(`Set ${calls.length} records on ${name}: ${hash}`);
