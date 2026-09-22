import { env } from "cloudflare:workers";
import { getIdentity } from "@/lib/inventory/auth";
import { fetchFl3xxSnapshot } from "@/lib/inventory/fl3xx";
import { inventoryDb } from "@/lib/inventory/db";
import { z } from "zod";

export async function GET() {
  try {
    const identity=await getIdentity();
    if(!identity)return Response.json({error:"Sign in"},{status:401});
    const result=await inventoryDb().prepare(`SELECT b.id,b.status,b.created_at AS createdAt,b.amount,
      l."from" AS fromCity,l.from_code AS fromCode,l."to" AS toCity,l.to_code AS toCode,
      l.departure_at AS departureAt,l.currency
      FROM bookings b JOIN listings l ON l.id=b.listing_id
      WHERE b.user_id=? ORDER BY b.created_at DESC LIMIT 50`).bind(identity.id).all();
    return Response.json({requests:result.results??[]});
  } catch(error) {
    console.error("Request list unavailable",error);
    return Response.json({error:"Requests unavailable"},{status:503});
  }
}

export async function POST(request:Request) {
  try {
    const identity=await getIdentity();
    if(!identity)return Response.json({error:"Sign in to request availability"},{status:401});
    const parsed=z.object({listingId:z.string().min(1).max(200)}).safeParse(await request.json());
    if(!parsed.success)return Response.json({error:"Invalid listing"},{status:400});
    const leg=await inventoryDb().prepare(`SELECT id,source,source_id AS sourceId,operator_id AS operatorId,
      price,currency,departure_at AS departureAt,status,last_seen_at AS lastSeenAt,seats
      FROM listings WHERE id=?`).bind(parsed.data.listingId)
      .first<{id:string;source:string;sourceId:string|null;operatorId:string;price:number;currency:string;departureAt:string;status:string;lastSeenAt:number|null;seats:number}>();
    if(!leg||leg.status!=="live"||Date.parse(leg.departureAt)<=Date.now())
      return Response.json({error:"This leg is no longer available"},{status:409});
    if(leg.source==="fl3xx") {
      const c=env as typeof env&{FL3XX_API_BASE_URL?:string;FL3XX_API_TOKEN?:string;FL3XX_OPERATOR_ID?:string};
      if(!c.FL3XX_API_BASE_URL||!c.FL3XX_API_TOKEN||!c.FL3XX_OPERATOR_ID||c.FL3XX_OPERATOR_ID!==leg.operatorId)
        return Response.json({error:"Operator connection unavailable"},{status:503});
      const snapshot=await fetchFl3xxSnapshot({baseUrl:c.FL3XX_API_BASE_URL,token:c.FL3XX_API_TOKEN,operatorId:c.FL3XX_OPERATOR_ID});
      const current=snapshot.legs.find(item=>item.sourceId===leg.sourceId);
      if(!current||current.price!==leg.price||current.currency!==leg.currency||
        current.departureAt!==leg.departureAt||current.seats!==leg.seats)
        return Response.json({error:"The operator changed this offer; refresh the listing"},{status:409});
    }
    const id=crypto.randomUUID();
    await inventoryDb().prepare("INSERT OR IGNORE INTO bookings(id,listing_id,user_id,amount,status,created_at) VALUES (?,?,?,?,'pending',?)")
      .bind(id,leg.id,identity.id,leg.price,Date.now()).run();
    const saved=await inventoryDb().prepare("SELECT id,status FROM bookings WHERE listing_id=? AND user_id=?")
      .bind(leg.id,identity.id).first<{id:string;status:string}>();
    return Response.json({id:saved?.id,status:saved?.status,notice:"Operator confirmation required before payment"},{status:202});
  } catch(error) {
    console.error("Availability request failed",error);
    return Response.json({error:"Could not verify this offer; please retry later"},{status:503});
  }
}
