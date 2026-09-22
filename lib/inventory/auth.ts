import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { inventoryDb } from "./db";

export async function getIdentity() {
  const user = await getChatGPTUser();
  if (!user) return null;
  const row = await inventoryDb().prepare("SELECT role FROM users WHERE id=?").bind(user.userId).first<{role: string}>();
  const allowlist = (env as typeof env & { OPERATOR_USER_IDS?: string }).OPERATOR_USER_IDS ?? "";
  const allowed = allowlist.split(",").map((id) => id.trim()).filter(Boolean).includes(user.userId);
  return { id: user.userId, email: user.email, role: row?.role ?? "traveller", canPublish: allowed || row?.role === "operator" || row?.role === "admin" };
}
