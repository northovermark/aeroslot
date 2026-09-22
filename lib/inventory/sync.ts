import { env } from "cloudflare:workers";
import { fetchFl3xxSnapshot } from "./fl3xx";
import { inventoryDb } from "./db";

export async function syncFl3xx() {
  const config = env as typeof env & {
    FL3XX_API_BASE_URL?: string;
    FL3XX_API_TOKEN?: string;
    FL3XX_OPERATOR_ID?: string;
  };
  if (!config.FL3XX_API_BASE_URL || !config.FL3XX_API_TOKEN || !config.FL3XX_OPERATOR_ID) {
    throw new Error("FL3XX credentials and operator ID are not configured");
  }
  const startedAt = Date.now();
  const db = inventoryDb();
  const key = `fl3xx:${config.FL3XX_OPERATOR_ID}`;
  try {
    const snapshot = await fetchFl3xxSnapshot({
      baseUrl: config.FL3XX_API_BASE_URL,
      token: config.FL3XX_API_TOKEN,
      operatorId: config.FL3XX_OPERATOR_ID,
    });
    // Any rejected row makes the feed incomplete. Preserve unseen inventory, but
    // still update valid rows. Never treat a failed or malformed response as empty.
    const statements = snapshot.legs.map((leg) =>
      db.prepare(`INSERT INTO listings
        (id, operator_id, "from", from_code, "to", to_code, departure_at, aircraft, seats, price,
         status, created_at, source, source_id, currency, arrival_at, tail_number, last_seen_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'live', ?, 'fl3xx', ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          "from"=excluded."from", from_code=excluded.from_code, "to"=excluded."to",
          to_code=excluded.to_code, departure_at=excluded.departure_at, aircraft=excluded.aircraft,
          seats=excluded.seats, price=excluded.price, currency=excluded.currency,
          arrival_at=excluded.arrival_at, tail_number=excluded.tail_number,
          last_seen_at=excluded.last_seen_at, updated_at=excluded.updated_at,
          status=CASE WHEN listings.status='booked' THEN 'booked' ELSE 'live' END`)
        .bind(leg.id, leg.operatorId, leg.from, leg.fromCode, leg.to, leg.toCode,
          leg.departureAt, leg.aircraft, leg.seats, leg.price, startedAt, leg.sourceId,
          leg.currency, leg.arrivalAt, leg.tailNumber, startedAt, startedAt)
    );
    for (let i = 0; i < statements.length; i += 50) await db.batch(statements.slice(i, i + 50));
    if (snapshot.rejected === 0) {
      await db.prepare(`UPDATE listings SET status='unavailable', updated_at=?
        WHERE source='fl3xx' AND operator_id=? AND status='live'
        AND (last_seen_at IS NULL OR last_seen_at < ?)`)
        .bind(startedAt, config.FL3XX_OPERATOR_ID, startedAt).run();
    }
    await db.prepare(`INSERT INTO source_syncs
      (id,provider,last_success_at,last_attempt_at,last_error,imported_count)
      VALUES (?,'fl3xx',?, ?,NULL,?)
      ON CONFLICT(id) DO UPDATE SET last_success_at=excluded.last_success_at,
        last_attempt_at=excluded.last_attempt_at,last_error=NULL,imported_count=excluded.imported_count`)
      .bind(key, startedAt, startedAt, snapshot.legs.length).run();
    await db.prepare(`INSERT OR IGNORE INTO alert_matches (id,alert_id,listing_id,created_at)
      SELECT alerts.id || ':' || listings.id, alerts.id, listings.id, ?
      FROM alerts JOIN listings ON listings.status='live' AND listings.source='fl3xx' AND listings.currency='EUR'
      WHERE alerts.active=1 AND (alerts.from_code IS NULL OR alerts.from_code=listings.from_code)
        AND (alerts.to_code IS NULL OR alerts.to_code=listings.to_code)
        AND (alerts.max_price IS NULL OR listings.price<=alerts.max_price)
        AND listings.seats>=COALESCE(alerts.min_seats,1)`)
      .bind(startedAt).run();
    return { imported: snapshot.legs.length, rejected: snapshot.rejected, removedUnseen: snapshot.rejected === 0, checkedAt: startedAt };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 200) : "Feed unavailable";
    await db.prepare(`INSERT INTO source_syncs (id,provider,last_attempt_at,last_error)
      VALUES (?,'fl3xx',?,?)
      ON CONFLICT(id) DO UPDATE SET last_attempt_at=excluded.last_attempt_at,last_error=excluded.last_error`)
      .bind(key, startedAt, message).run();
    throw error;
  }
}
