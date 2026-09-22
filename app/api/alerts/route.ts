import { env } from "cloudflare:workers";
import { getIdentity } from "@/lib/inventory/auth";
import { inventoryDb } from "@/lib/inventory/db";
import { z } from "zod";
const input = z.object({
  fromCode: z.string().trim().toUpperCase().regex(/^[A-Z]{3,4}$/).nullable(),
  toCode: z.string().trim().toUpperCase().regex(/^[A-Z]{3,4}$/).nullable(),
  maxPrice: z.number().positive().nullable(),
  minSeats: z.number().int().min(1).max(100),
}).refine(v=>v.fromCode||v.toCode, "Choose at least one airport");

export async function POST(request:Request) {
  try {
    const identity=await getIdentity();
    if(!identity)return Response.json({error:"Sign in to save an alert"},{status:401});
    const parsed=input.safeParse(await request.json());
    if(!parsed.success)return Response.json({error:"Enter an airport code to create an alert"},{status:400});
    const id=crypto.randomUUID();
    await inventoryDb().prepare("INSERT INTO alerts(id,user_id,from_code,to_code,max_price,min_seats,active) VALUES (?,?,?,?,?,?,1)")
      .bind(id,identity.id,parsed.data.fromCode,parsed.data.toCode,parsed.data.maxPrice,parsed.data.minSeats).run();
    return Response.json({id,status:"saved",delivery:"not_configured"},{status:201});
  } catch(error) {
    console.error("Alert save failed",error);
    return Response.json({error:"Could not save alert"},{status:503});
  }
}
