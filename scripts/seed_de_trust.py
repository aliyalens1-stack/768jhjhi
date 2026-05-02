"""seed_de_trust.py — Sprint 34 Day 4 / Mini-PR B.

Two responsibilities:

1. Re-name three demo provider organizations to DE marketing names so
   the Berlin pivot demo no longer shows Russian names in the
   ProviderCard. Slugs stay stable so booking flow keeps working.

2. Backfill trust fields on every organization for the ProviderCard
   trust-block (TÜV badge + experience + jobs done):
     - tuvVerified: bool
     - yearsExperience: int (5..18)
     - vehiclesInspected: int (120..600)
     - avgResponseTimeMinutes: int (8..26) if missing

Hash-based deterministic — re-runs are idempotent.
Run:   cd /app && python3 scripts/seed_de_trust.py
"""
import asyncio
import hashlib
from motor.motor_asyncio import AsyncIOMotorClient


# Slug → DE marketing identity for the top-3 demo providers used in
# quick-request flow (Berlin pivot copy).
DE_RENAMES = {
    "avtomaster-pro": {
        "name": "Klaus Müller Auto",
        "description": "TÜV-zertifizierte Werkstatt in Berlin Mitte. 12 Jahre Erfahrung, faire Pauschalpreise.",
        "address": "Friedrichstraße 100, 10117 Berlin Mitte",
        "tuvVerified": True,
        "yearsExperience": 12,
        "vehiclesInspected": 320,
    },
    "mobile-service-24": {
        "name": "Berlin Mobile Service",
        "description": "Mobile Werkstatt — kommt zu Ihnen. 8 Jahre Erfahrung, pünktlich und transparent.",
        "address": "Karl-Marx-Straße 220, 12055 Berlin Neukölln",
        "tuvVerified": False,
        "yearsExperience": 8,
        "vehiclesInspected": 210,
    },
    "brake-service": {
        "name": "Brake Service Mitte",
        "description": "Bremsen-Spezialist Berlin. 15 Jahre Erfahrung, TÜV-zertifiziert, Original-Ersatzteile.",
        "address": "Torstraße 100, 10119 Berlin Mitte",
        "tuvVerified": True,
        "yearsExperience": 15,
        "vehiclesInspected": 540,
    },
}


def derive_trust(slug: str) -> dict:
    """Hash-based deterministic trust fields for any provider not in DE_RENAMES."""
    h = int(hashlib.md5(slug.encode("utf-8")).hexdigest()[:8], 16)
    return {
        "yearsExperience":   5 + (h % 14),       # 5..18
        "vehiclesInspected": 120 + ((h * 17) % 480),   # 120..600
        "tuvVerified":       (h % 2 == 0),
        "avgResponseTimeMinutes": 8 + (h % 18),  # 8..26 (only set if missing)
    }


async def main():
    c = AsyncIOMotorClient("mongodb://localhost:27017")
    db = c["auto_platform"]

    renamed = 0
    enriched = 0

    async for org in db.organizations.find({}):
        slug = org.get("slug") or ""
        if not slug:
            continue

        update = {}

        # 1. Top-3 DE renames (idempotent — same payload every time).
        if slug in DE_RENAMES:
            for k, v in DE_RENAMES[slug].items():
                update[k] = v
            renamed += 1

        # 2. Trust enrichment fallback. Only fill fields that are absent
        # so curated DE_RENAMES values win.
        derived = derive_trust(slug)
        if "yearsExperience" not in update and org.get("yearsExperience") is None:
            update["yearsExperience"] = derived["yearsExperience"]
        if "vehiclesInspected" not in update and org.get("vehiclesInspected") is None:
            update["vehiclesInspected"] = derived["vehiclesInspected"]
        if "tuvVerified" not in update and org.get("tuvVerified") is None:
            update["tuvVerified"] = derived["tuvVerified"]
        if org.get("avgResponseTimeMinutes") is None:
            update["avgResponseTimeMinutes"] = derived["avgResponseTimeMinutes"]

        if update:
            await db.organizations.update_one({"_id": org["_id"]}, {"$set": update})
            if slug not in DE_RENAMES:
                enriched += 1

    print(f"  ✓ renamed_to_DE: {renamed}")
    print(f"  ✓ trust_enriched_fallback: {enriched}")
    print("  ── Verify ──")

    for slug in DE_RENAMES.keys():
        doc = await db.organizations.find_one({"slug": slug})
        if doc:
            print(
                f"    {slug:25}  name={doc.get('name'):30}  "
                f"tuv={doc.get('tuvVerified')}  "
                f"yrs={doc.get('yearsExperience')}  "
                f"jobs={doc.get('vehiclesInspected')}"
            )


if __name__ == "__main__":
    asyncio.run(main())
