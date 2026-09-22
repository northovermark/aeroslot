import { env } from "cloudflare:workers";

export function inventoryDb(): NonNullable<typeof env.DB> {
  if (!env.DB) throw new Error("Inventory database binding unavailable");
  return env.DB;
}
