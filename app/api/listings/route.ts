import { env } from "cloudflare:workers";
import { getIdentity } from "@/lib/inventory/auth";
import { inventoryDb } from "@/lib/inventory/db";
import { z } from "zod";

const createListing = z.object({
  from: z.string().trim().min(2).max(100),
  fromCode: z.string().trim().toUpperCase().regex(/^[A-Z]{3,4}$/),
  to: z.string().trim().min(2).max(100),
  toCode: z.string().trim().toUpperCase().regex(/^[A-Z]{3,4}$/),
  departureAt: z.string().datetime({ offset: true }),
  aircraft: z.string().trim().min(2).max(120),
  seats: z.number().int().min(1).max(100),
  price: z.number().positive().max(10000000),
  currency: z.string().regex(/^[A-Z]{3}$/).default("EUR"),
}).refine((value) => value.fromCode !== value.toCode && Date.parse(value.departureAt) > Date.now(), "Invalid route or departure");

export async function GET() {
  try {
    const now = Date.now();
    const rows = await inventoryDb().prepare(`SELECT id, "from", from_code AS fromCode, "to", to_code AS toCode,
      departure_at AS departureAt, arrival_at AS arrivalAt, aircraft, seats, price, currency,
      source, last_seen_at AS lastSeenAt, updated_at AS updatedAt,
      from_lat AS fromLat, from_lng AS fromLng, to_lat AS toLat, to_lng AS toLng
      FROM listings WHERE status='live' AND departure_at>? AND
      (source!='fl3xx' OR last_seen_at>=?)
      ORDER BY departure_at LIMIT 250`)
      .bind(new Date(now).toISOString(), now - 30 * 60000).all();
    return Response.json({ listings: rows.results ?? [], checkedAt: now });
  } catch (error) {
    console.error("Inventory read unavailable", error);
    return Response.json({ error: "Inventory temporarily unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const identity = await getIdentity();
    if (!identity) return Response.json({ error: "Sign in to publish" }, { status: 401 });
    if (!identity.canPublish) return Response.json({ error: "Operator access required" }, { status: 403 });
    const parsed = createListing.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Check the route, UTC departure and price" }, { status: 400 });
    const leg = parsed.data;
    const id = crypto.randomUUID();
    const now = Date.now();
    await inventoryDb().prepare(`INSERT INTO listings
      (id,operator_id,"from",from_code,"to",to_code,departure_at,aircraft,seats,price,status,
       created_at,source,currency,last_seen_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,'live',?,'operator',?,?,?)`)
      .bind(id, identity.id, leg.from, leg.fromCode, leg.to, leg.toCode,
        leg.departureAt, leg.aircraft, leg.seats, leg.price, now, leg.currency, now, now).run();
    return Response.json({ id, status: "live" }, { status: 201 });
  } catch (error) {
    console.error("Operator listing error", error);
    return Response.json({ error: "Could not publish listing" }, { status: 503 });
  }
}
