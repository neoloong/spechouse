"""
AI-powered natural language search parser.
Uses Claude Haiku for fast, cheap query parsing.
Falls back to regex if no ANTHROPIC_API_KEY is set.
"""
import json
import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

# ── Regex fallback ────────────────────────────────────────────────────────────

def _regex_parse(query: str) -> dict:
    """Best-effort regex extraction when Claude is unavailable."""
    result: dict = {}
    q = query.lower()

    # "2b2b", "2bd/2ba", "2 bed 2 bath", "2br/2ba"
    m = re.search(
        r'(\d+)\s*(?:b[dr]|bed(?:room)?s?)\s*/?\s*(\d+(?:\.\d+)?)\s*(?:ba(?:th)?s?)',
        q,
    )
    if m:
        result["beds"] = int(m.group(1))
        result["baths"] = float(m.group(2))
    else:
        m = re.search(r'(\d+)\s*(?:bed(?:room)?s?|br\b|bdr)', q)
        if m:
            result["beds"] = int(m.group(1))
        m2 = re.search(r'(\d+(?:\.\d+)?)\s*(?:bath(?:room)?s?|\bba\b)', q)
        if m2:
            result["baths"] = float(m2.group(1))

    # Price: "under $800k", "max $1m", "$1.5m", "800000"
    m = re.search(r'(?:under|max|below|<)\s*\$?([\d,.]+)\s*([km])?', q)
    if not m:
        m = re.search(r'\$\s*([\d,.]+)\s*([km])?', q)
    if m:
        val = float(m.group(1).replace(",", ""))
        suffix = (m.group(2) or "").lower()
        mult = {"k": 1_000, "m": 1_000_000}.get(suffix, 1)
        result["max_price"] = int(val * mult)

    # Property type
    for pattern, ptype in [
        (r"\btownhouse\b", "townhouse"),
        (r"\bcondo\b", "condo"),
        (r"\bmulti.?family\b", "multi-family"),
        (r"\bsingle.?family\b", "house"),
        (r"\bhouse\b|\bsfr\b|\bhome\b", "house"),
        (r"\bstudio\b", "condo"),
        (r"\bland\b|\blot\b", "land"),
    ]:
        if re.search(pattern, q):
            result["property_type"] = ptype
            break

    # Sqft: "2000+ sqft", "min 1500 sqft"
    m = re.search(r'(\d{3,5})\+?\s*(?:sq\.?\s*ft\.?|sqft)', q)
    if m:
        result["min_sqft"] = int(m.group(1))

    # City/state extraction via word-level US state code matching
    _US_STATES = {
        "al","ak","az","ar","ca","co","ct","de","fl","ga","hi","id","il","ia",
        "ks","ky","la","me","md","ma","mi","mn","ms","mo","mt","ne","nv","nh",
        "nj","nm","ny","nc","nd","oh","ok","or","pa","ri","sc","sd","tn","tx",
        "ut","vt","va","wa","wv","wi","wy","dc",
    }
    words = q.split()
    for i, w in enumerate(words):
        clean = w.strip(",.!?")
        if clean in _US_STATES and i > 0:
            state_code = clean.upper()
            # City = words between "in" (or start) and this state code
            try:
                in_idx = words.index("in")
                city_words = [ww.strip(",.") for ww in words[in_idx + 1: i]]
            except ValueError:
                city_words = [ww.strip(",.") for ww in words[max(0, i - 3): i]]
            # Filter out obvious non-city words
            _SKIP = {
                "and","with","under","max","min","near","for","a","the","in",
                "bed","beds","bedroom","bedrooms","bath","baths","bathroom",
                "house","condo","townhouse","home","apartment","studio",
                "single","family","multi","sqft","sqf","bedroom","br","ba",
            }
            city_words = [ww for ww in city_words if ww.lower() not in _SKIP and len(ww) > 1]
            if city_words:
                result["city"] = " ".join(city_words).title()
                result["state"] = state_code
            break

    # Build summary
    if result:
        parts = []
        if pt := result.get("property_type"):
            parts.append(pt.title())
        if b := result.get("beds"):
            ba = result.get("baths")
            parts.append(f"{b}bd/{ba}ba" if ba else f"{b}bd")
        elif ba := result.get("baths"):
            parts.append(f"{ba}ba")
        if c := result.get("city"):
            loc = f"in {c}"
            if s := result.get("state"):
                loc += f", {s}"
            parts.append(loc)
        if mp := result.get("max_price"):
            parts.append(f"under ${mp:,.0f}")
        result["parsed_summary"] = " ".join(parts) if parts else query

    return result


# ── Claude parser ─────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """\
You are a real estate search parameter extractor. Given a user's natural language query,
extract structured search parameters and return ONLY a valid JSON object with these fields
(all optional — only include what is clearly stated or implied):

{
  "city": "string — city name only, no state",
  "state": "string — 2-letter US state code (e.g. CA, TX)",
  "beds": integer — minimum bedrooms,
  "baths": number — minimum bathrooms (can be 1.5, 2.5),
  "min_price": integer,
  "max_price": integer,
  "property_type": "house" | "condo" | "townhouse" | "multi-family" | "land",
  "min_sqft": integer,
  "parsed_summary": "string — brief human-readable description of what was extracted"
}

Price shorthands: 800k = 800000, 1.5m = 1500000.
"2b2b" means 2 beds, 2 baths.
Return ONLY the JSON object, no markdown, no explanation."""


async def parse_query(query: str) -> dict:
    """Parse a natural language real estate query into structured filter params."""
    from backend.config import settings

    if not settings.ANTHROPIC_API_KEY or settings.ANTHROPIC_API_KEY.startswith("your_"):
        logger.info("No ANTHROPIC_API_KEY — using regex parse")
        return _regex_parse(query)

    try:
        import anthropic  # lazy import — optional dependency

        client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        message = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": query}],
        )
        text = message.content[0].text.strip()

        # Extract JSON block (handles code fences if Claude adds them)
        m = re.search(r"\{[^{}]+\}", text, re.DOTALL)
        if m:
            parsed = json.loads(m.group(0))
            # Ensure parsed_summary exists
            if "parsed_summary" not in parsed and parsed:
                parsed["parsed_summary"] = query
            logger.info(f"AI parse '{query}' → {parsed}")
            return parsed
    except Exception as exc:
        logger.warning(f"Claude parse failed: {exc!r} — falling back to regex")

    return _regex_parse(query)
