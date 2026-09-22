import { env } from "cloudflare:workers";
import { syncFl3xx } from "@/lib/inventory/sync";

export async function POST(request: Request) {
  const expected = (env as typeof env & { INVENTORY_SYNC_TOKEN?: string }).INVENTORY_SYNC_TOKEN;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return Response.json(await syncFl3xx());
  } catch (error) {
    console.error("Inventory sync failed", error);
    return Response.json({ error: "Provider sync failed; existing inventory retained" }, { status: 502 });
  }
}
