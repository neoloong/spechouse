import { NextRequest, NextResponse } from "next/server";

// ── Geographic agent matching (mock) ────────────────────────────────────────
const AGENTS_BY_CITY: Record<string, { name: string; email: string }> = {
  "san francisco": { name: "Alex Rivera", email: "alex.rivera@spechouse.com" },
  "los angeles": { name: "Jordan Lee", email: "jordan.lee@spechouse.com" },
  "new york": { name: "Sam Chen", email: "sam.chen@spechouse.com" },
  "chicago": { name: "Morgan Blake", email: "morgan.blake@spechouse.com" },
  "houston": { name: "Taylor Kim", email: "taylor.kim@spechouse.com" },
  "phoenix": { name: "Casey Patel", email: "casey.patel@spechouse.com" },
  "philadelphia": { name: "Quinn Davis", email: "quinn.davis@spechouse.com" },
  "san antonio": { name: "Avery Martinez", email: "avery.martinez@spechouse.com" },
  "san diego": { name: "Riley Johnson", email: "riley.johnson@spechouse.com" },
  "dallas": { name: "Drew Wilson", email: "drew.wilson@spechouse.com" },
  "austin": { name: "Blake Thompson", email: "blake.thompson@spechouse.com" },
  "seattle": { name: "Sage Anderson", email: "sage.anderson@spechouse.com" },
  "denver": { name: "Reese Clark", email: "reese.clark@spechouse.com" },
  "boston": { name: "Hayden White", email: "hayden.white@spechouse.com" },
  "atlanta": { name: "Charlie Brown", email: "charlie.brown@spechouse.com" },
  "miami": { name: "Parker Scott", email: "parker.scott@spechouse.com" },
  "las vegas": { name: "Skyler Green", email: "skyler.green@spechouse.com" },
  "portland": { name: "Emery Lewis", email: "emery.lewis@spechouse.com" },
  "nashville": { name: "Finley Adams", email: "finley.adams@spechouse.com" },
  "tampa": { name: "Rowan Baker", email: "rowan.baker@spechouse.com" },
};

const GENERAL_AGENT = { name: "Chris Morgan", email: "chris.morgan@spechouse.com" };

function findAgent(city: string): { name: string; email: string } {
  const normalized = city.trim().toLowerCase();
  return AGENTS_BY_CITY[normalized] ?? GENERAL_AGENT;
}

// ── Validation ───────────────────────────────────────────────────────────────
export interface LeadPayload {
  name: string;
  phone: string;
  email: string;
  city: string;
  propertyIds: string[];
}

export interface ValidationError {
  field: string;
  message: string;
}

function validateLead(body: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof body !== "object" || body === null) {
    errors.push({ field: "body", message: "Invalid request body" });
    return errors;
  }

  const b = body as Record<string, unknown>;

  // name
  if (!b.name || typeof b.name !== "string" || b.name.trim().length < 2) {
    errors.push({ field: "name", message: "Name must be at least 2 characters" });
  }

  // phone — must have 10+ digits
  const phoneRaw = typeof b.phone === "string" ? b.phone.replace(/\D/g, "") : "";
  if (!b.phone || typeof b.phone !== "string" || phoneRaw.length < 10) {
    errors.push({ field: "phone", message: "Phone number must have at least 10 digits" });
  }

  // email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!b.email || typeof b.email !== "string" || !emailRegex.test(b.email.trim())) {
    errors.push({ field: "email", message: "A valid email address is required" });
  }

  // city
  if (!b.city || typeof b.city !== "string" || b.city.trim().length === 0) {
    errors.push({ field: "city", message: "City is required" });
  }

  // propertyIds
  if (
    !Array.isArray(b.propertyIds) ||
    b.propertyIds.length === 0 ||
    !b.propertyIds.every((id) => typeof id === "string" && id.trim().length > 0)
  ) {
    errors.push({ field: "propertyIds", message: "At least one property selection is required" });
  }

  return errors;
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, errors: [{ field: "body", message: "Invalid JSON body" }] },
      { status: 400 }
    );
  }

  const errors = validateLead(body);
  if (errors.length > 0) {
    return NextResponse.json({ success: false, errors }, { status: 400 });
  }

  const { name, phone, email, city, propertyIds } = body as LeadPayload;

  // In production this would persist the lead; for now we just match an agent.
  const agent = findAgent(city);

  // Simulate a short processing delay
  await new Promise((r) => setTimeout(r, 200));

  return NextResponse.json({
    success: true,
    message: `Thanks, ${name}! We'll connect you with a local agent shortly.`,
    agentContact: agent.email,
  });
}
