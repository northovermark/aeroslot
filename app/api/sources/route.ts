import { env } from "cloudflare:workers";
import { getIdentity } from "@/lib/inventory/auth";
import { inventoryDb } from "@/lib/inventory/db";

export async function GET() {
  const configured = Boolean((env as typeof env & {
    FL3XX_API_TOKEN?: string; FL3XX_API_BASE_URL?: string; FL3XX_OPERATOR_ID?: string;
  }).FL3XX_API_TOKEN && (env as typeof env & { FL3XX_API_BASE_URL?: string }).FL3XX_API_BASE_URL &&
    (env as typeof env & { FL3XX_OPERATOR_ID?: string }).FL3XX_OPERATOR_ID);
  try {
    const identity = await getIdentity();
    const record = await inventoryDb().prepare("SELECT last_success_at AS lastSuccessAt, imported_count AS importedCount, last_error AS lastError FROM source_syncs WHERE provider='fl3xx' ORDER BY last_attempt_at DESC LIMIT 1")
      .first<{lastSuccessAt:number|null;importedCount:number;lastError:string|null}>();
    return Response.json({
      sources: [
        { id: "fl3xx", name: "FL3XX", configured, lastSuccessAt: record?.lastSuccessAt ?? null,
          importedCount: record?.importedCount ?? 0, needsAttention: Boolean(record?.lastError) },
        { id: "avinode", name: "Avinode", configured: false, contractRequired: true },
        { id: "leon", name: "Leon", configured: false, contractRequired: true },
      ],
      user: identity ? { email: identity.email, canPublish: identity.canPublish } : null,
    });
  } catch (error) {
    console.error("Source status unavailable", error);
    return Response.json({ error: "Status temporarily unavailable" }, { status: 503 });
  }
}
