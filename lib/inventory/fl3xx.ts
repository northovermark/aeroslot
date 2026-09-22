/** FL3XX priced empty-leg feed. The operator must select and price each leg in FL3XX. */
export type NormalizedLeg = {
  id: string;
  source: "fl3xx";
  sourceId: string;
  operatorId: string;
  from: string;
  fromCode: string;
  to: string;
  toCode: string;
  departureAt: string;
  arrivalAt: string | null;
  aircraft: string;
  tailNumber: string | null;
  seats: number;
  price: number;
  currency: string;
};

type FeedLeg = {
  id?: number | string;
  from?: string;
  to?: string;
  date?: number;
  datearr?: number;
  seats?: number;
  price?: number;
  currency?: string;
  type?: string;
  tailnumber?: string;
};

function airport(value: unknown) {
  if (typeof value !== "string") return null;
  const parts = value.toUpperCase().trim().split(/\s+/);
  const code = parts.find((part) => /^[A-Z]{3}$/.test(part)) ?? parts.find((part) => /^[A-Z]{4}$/.test(part));
  return code ? { label: parts[0], code } : null;
}

export function normalizeFl3xxLeg(raw: FeedLeg, operatorId: string, now = Date.now()): NormalizedLeg | null {
  const from = airport(raw.from);
  const to = airport(raw.to);
  const departure = Number(raw.date);
  const price = Number(raw.price);
  const seats = Number(raw.seats);
  const currency = typeof raw.currency === "string" ? raw.currency.toUpperCase() : "";
  if (raw.id == null || !from || !to || from.code === to.code ||
    !Number.isFinite(departure) || departure <= now || departure > now + 365 * 86400000 ||
    !Number.isFinite(seats) || !Number.isInteger(seats) || seats < 1 || seats > 100 ||
    !Number.isFinite(price) || price <= 0 || !/^[A-Z]{3}$/.test(currency)) return null;

  const arrival = Number(raw.datearr);
  return {
    id: `fl3xx:${operatorId}:${raw.id}`,
    source: "fl3xx",
    sourceId: String(raw.id),
    operatorId,
    from: from.label,
    fromCode: from.code,
    to: to.label,
    toCode: to.code,
    departureAt: new Date(departure).toISOString(),
    arrivalAt: Number.isFinite(arrival) && arrival > departure ? new Date(arrival).toISOString() : null,
    aircraft: String(raw.type || raw.tailnumber || "Private aircraft").slice(0, 120),
    tailNumber: typeof raw.tailnumber === "string" ? raw.tailnumber.slice(0, 32) : null,
    seats,
    price,
    currency,
  };
}

export async function fetchFl3xxSnapshot(config: { baseUrl: string; token: string; operatorId: string }) {
  const base = new URL(config.baseUrl);
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) {
    throw new Error("FL3XX_API_BASE_URL must be an HTTPS origin or path without credentials");
  }
  const url = new URL("api/external/quote/legs/empty", base.toString().replace(/\/?$/, "/"));
  const response = await fetch(url, {
    headers: { "X-Auth-Token": config.token, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`FL3XX returned HTTP ${response.status}`);
  const body: unknown = await response.json();
  if (!Array.isArray(body)) throw new Error("Unexpected FL3XX response shape; snapshot not applied");
  if (body.length > 10000) throw new Error("Snapshot exceeds safe batch size");
  const normalized = body.map((item) => normalizeFl3xxLeg(item as FeedLeg, config.operatorId));
  const rejected = normalized.filter((item) => item === null).length;
  return { legs: normalized.filter((item): item is NormalizedLeg => item !== null), rejected, total: body.length };
}
