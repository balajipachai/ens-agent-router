import { createPublicClient, http, type PublicClient } from "viem";
import { sepolia } from "viem/chains";
import { normalize } from "viem/ens";

export class InvalidEnsNameError extends Error {
  constructor(message = "That is not a valid ENS name.") {
    super(message);
    this.name = "InvalidEnsNameError";
  }
}

/** ENSIP-15 normalization. Runs before any resolution call. */
export function normalizeEnsName(input: string): string {
  const trimmed = input.trim();
  if (trimmed === "" || trimmed.length > 255 || !trimmed.includes(".")) throw new InvalidEnsNameError();
  try {
    return normalize(trimmed);
  } catch {
    throw new InvalidEnsNameError();
  }
}

let client: PublicClient | undefined;
export function defaultClient(): PublicClient {
  client ??= createPublicClient({
    chain: sepolia,
    transport: http(process.env.SEPOLIA_RPC_URL || undefined),
  }) as PublicClient;
  return client;
}
