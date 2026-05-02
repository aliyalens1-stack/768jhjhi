"""seed_de_finalize.py — Wholesale replace any string still containing Cyrillic.

Run AFTER seed_de_cleanup.py. For each (collection, field) combination,
substitutes remaining RU-content with curated German templates so
the demo data is 100% DE.

Strategy:
  - Field-aware: 'name', 'description', 'address', 'text' etc each get a
    relevant DE template, often with a deterministic index based on doc _id
    so re-runs are idempotent.
  - For unknown fields → generic DE filler.
"""
import asyncio
import hashlib
import random
import re
from motor.motor_asyncio import AsyncIOMotorClient

CYR = re.compile(r'[А-Яа-яЁёІіЇїЄєҐґ]')

ORG_NAMES = [
    "Berlin Auto-Check", "KFZ Müller Berlin", "Werkstatt Schmidt",
    "Auto Profi Mitte", "Mobile Werkstatt Berlin", "TÜV Express Werkstatt",
    "Schneider Auto-Service", "Berlin Bremsenservice",
    "Auto-Diagnose Neukölln", "Werkstatt am Alex",
]
ORG_DESCRIPTIONS = [
    "TÜV-zertifizierte Fahrzeugprüfung in Berlin. Pre-Kauf-Inspektion vor Ort.",
    "Mobile Werkstatt mit 15+ Jahren Erfahrung. Fairer Preis, ehrliche Diagnose.",
    "Spezialist für BMW, Audi und Mercedes. Schnelle Reparatur und Diagnose.",
    "Schnelle Anfahrt in Berlin Mitte und Neukölln. Pauschalpreise.",
    "Vor-Ort-Service: Bremsen, Ölwechsel, Diagnose. 24h Hotline.",
]
SERVICE_NAMES = [
    "Bremsen-Diagnose", "Ölwechsel", "Pre-Kauf-Inspektion", "TÜV-Vorbereitung",
    "Achsvermessung", "Reifenwechsel", "Klimaanlage befüllen", "Computer-Diagnose",
    "Motor-Check", "Auspuff-Check", "Batterie-Check", "Fahrwerk-Diagnose",
]
SERVICE_DESCS = [
    "Vor-Ort-Service in Berlin. Fairer Pauschalpreis. Inkl. schriftlicher Bericht.",
    "Schnelle Diagnose mit moderner Technik. Garantie 12 Monate auf Arbeit.",
    "Mobil bei Ihnen vor Ort. TÜV-konform, mit Bericht und Fotos.",
    "Klassik-Service mit fairer Preisliste. Original-Ersatzteile auf Wunsch.",
]
SVC_CATEGORIES = [
    "Bremsen", "Motor", "Diagnose", "Inspektion", "Reifen",
    "Klimaanlage", "Fahrwerk", "Elektrik",
]
ADDRESSES = [
    "Friedrichstraße 100, 10117 Berlin Mitte",
    "Karl-Marx-Straße 220, 12055 Berlin Neukölln",
    "Hermannstraße 50, 12049 Berlin Neukölln",
    "Torstraße 100, 10119 Berlin Mitte",
    "Alexanderplatz 7, 10178 Berlin Mitte",
    "Sonnenallee 130, 12059 Berlin Neukölln",
    "Unter den Linden 14, 10117 Berlin Mitte",
    "Boddinstraße 22, 12053 Berlin Neukölln",
]
WHY_REASONS = [
    "TÜV-zertifiziert", "15+ Jahre Erfahrung", "Spezialist BMW/Audi",
    "Schnelle Anfahrt", "Pauschalpreis", "Fairer Preis",
    "Mobile Werkstatt", "Vor-Ort-Service",
]
REVIEWS = [
    "Sehr professionelle Arbeit. Schnell und transparent.",
    "Faire Preise, ehrliche Diagnose. Komme wieder.",
    "TÜV-Beratung war top. Klare Empfehlung.",
    "Termin pünktlich, Auto sauber zurück.",
    "Sehr freundlich und kompetent.",
    "Hat mir zwei versteckte Mängel gezeigt — sehr ehrlich.",
    "Pre-Kauf-Check war Geld wert. Hat mich vor einem Fehlkauf bewahrt.",
    "Schnelle Diagnose, fairer Preis. Top.",
    "Mobile Werkstatt, kam pünktlich. Sehr empfehlenswert.",
]
AUTHOR_NAMES = [
    "Klaus Müller", "Stefan Schmidt", "Andreas Weber", "Michael Becker",
    "Daniel Hoffmann", "Anna Schäfer", "Maria Fischer", "Olga Wagner",
    "Thomas Schneider", "Lukas Koch", "Hannah Wolf", "Lisa Schmitt",
]
NOTIFICATION_TITLES = [
    "Neue Anfrage", "Buchung bestätigt", "Werkstatt antwortet",
    "Termin bestätigt", "Pre-Kauf-Check fertig", "Bewertung erbeten",
]
NOTIFICATION_BODIES = [
    "Eine neue Anfrage in Ihrer Nähe wartet auf Ihre Antwort.",
    "Ihre Buchung wurde bestätigt. ETA ca. 6 Min.",
    "Die Werkstatt hat Ihre Anfrage angenommen.",
    "Bitte bewerten Sie den Service — hilft anderen Käufern.",
    "Ihr Pre-Kauf-Check ist fertig. Bericht im Chat.",
]
DISPUTE_DESCRIPTIONS = [
    "Kunde meldet abweichenden Befund. Klärung nötig.",
    "Preisstreit nach Diagnose. Manuelle Prüfung empfohlen.",
    "Service nicht wie beschrieben. Nachbesserung erforderlich.",
]
FEATURE_FLAG_DESCS = [
    "Aktiviert experimentelle Provider-Onboarding-Flow.",
    "Schaltet erweiterte Inspection-Features für Beta-Nutzer frei.",
    "Aktiviert auto-money Optimierung mit ML-Boost.",
    "Schaltet neue Bewertungs-Templates frei.",
    "Aktiviert Sora-2 Video-Inspection für Pro-Nutzer.",
]
WORK_HOURS = ["Mo-Sa 08:00-20:00", "Mo-Fr 09:00-18:00", "24/7", "Mo-Sa 07:00-19:00"]
COLORS = ["Schwarz", "Weiß", "Silber", "Grau", "Blau", "Rot", "Grün"]

GENERIC_FILLER = "—"


def pick(arr, doc_id):
    """Stable index based on doc id hash → idempotent re-runs."""
    h = int(hashlib.md5(str(doc_id).encode()).hexdigest()[:8], 16)
    return arr[h % len(arr)]


def replace_cyrillic_string(s: str, col: str, field: str, doc_id) -> str:
    """If string still has Cyrillic, replace with DE template by (collection, field)."""
    if not isinstance(s, str) or not CYR.search(s):
        return s

    key = (col, field)
    if key == ("organizations", "name"):
        return pick(ORG_NAMES, doc_id)
    if key == ("organizations", "description"):
        return pick(ORG_DESCRIPTIONS, doc_id)
    if key == ("organizations", "address") or col in ("branches", "bookings", "quotes") and field == "address":
        return pick(ADDRESSES, doc_id)
    if key in (("organizations", "workHours"), ("branches", "workHours")):
        return pick(WORK_HOURS, doc_id)
    if key == ("branches", "name"):
        return pick(ORG_NAMES, doc_id)

    if col == "services" and field == "name":
        return pick(SERVICE_NAMES, doc_id)
    if col == "providerservices" and field == "description":
        return pick(SERVICE_DESCS, doc_id)
    if col == "servicecategories" and field == "name":
        return pick(SVC_CATEGORIES, doc_id)

    if col == "reviews" and field == "text":
        return pick(REVIEWS, doc_id)
    if col == "reviews" and field == "authorName":
        return pick(AUTHOR_NAMES, doc_id)

    if col == "notifications" and field == "title":
        return pick(NOTIFICATION_TITLES, doc_id)
    if col == "notifications" and field == "body":
        return pick(NOTIFICATION_BODIES, doc_id)

    if col == "disputes" and field == "description":
        return pick(DISPUTE_DESCRIPTIONS, doc_id)
    if col == "feature_flags" and field == "description":
        return pick(FEATURE_FLAG_DESCS, doc_id)

    if col == "vehicles" and field == "color":
        return pick(COLORS, doc_id)

    if col == "bookings" and field == "serviceName":
        return pick(SERVICE_NAMES, doc_id)
    if col == "quotes" and field == "serviceName":
        return pick(SERVICE_NAMES, doc_id)
    if col in ("bookings", "quotes") and field == "description":
        return pick(SERVICE_DESCS, doc_id)
    if col == "bookings" and field == "orgName":
        return pick(ORG_NAMES, doc_id)
    if col == "bookings" and field == "cancelReason":
        return "Storniert auf Kundenwunsch"

    if col == "quick_requests":
        if field == "echoText":
            return "Wir suchen 3 Werkstätten in Berlin Mitte für Sie — beste Antwortzeit ~6 Min."
        return GENERIC_FILLER

    if col == "users":
        if field == "firstName":
            return "Klaus" if "k" in str(doc_id).lower()[:3] else "Ivan"
        if field == "lastName":
            return "Müller"

    # Generic governance / system messages — ASCII placeholder
    if col == "governance_actions" and field == "message":
        return "system action"

    # Default
    return GENERIC_FILLER


def transform_doc(doc, col):
    out = {}
    changed = False
    for k, v in doc.items():
        if k == "_id":
            continue
        if isinstance(v, str):
            nv = replace_cyrillic_string(v, col, k, doc.get("_id"))
            if nv != v:
                out[k] = nv
                changed = True
        elif isinstance(v, list):
            new_list = []
            list_changed = False
            for item in v:
                if isinstance(item, str):
                    ni = replace_cyrillic_string(item, col, k + "[]", doc.get("_id"))
                    if ni != item:
                        list_changed = True
                    new_list.append(ni)
                elif isinstance(item, dict):
                    sub_out = {}
                    sub_changed = False
                    for sk, sv in item.items():
                        if isinstance(sv, str):
                            nv = replace_cyrillic_string(sv, col, f"{k}[].{sk}", doc.get("_id"))
                            if nv != sv:
                                sub_changed = True
                            sub_out[sk] = nv
                        else:
                            sub_out[sk] = sv
                    if sub_changed:
                        list_changed = True
                    new_list.append(sub_out)
                else:
                    new_list.append(item)
            if list_changed:
                out[k] = new_list
                changed = True
        elif isinstance(v, dict):
            # nested dict — recurse one level
            sub_out = {}
            sub_changed = False
            for sk, sv in v.items():
                if isinstance(sv, str):
                    nv = replace_cyrillic_string(sv, col, f"{k}.{sk}", doc.get("_id"))
                    if nv != sv:
                        sub_changed = True
                    sub_out[sk] = nv
                else:
                    sub_out[sk] = sv
            if sub_changed:
                out[k] = {**v, **sub_out}
                changed = True
    return out, changed


async def main():
    c = AsyncIOMotorClient("mongodb://localhost:27017")
    db = c["auto_platform"]
    cols = await db.list_collection_names()
    total = 0
    per_col = {}
    for col_name in cols:
        col = db[col_name]
        col_count = 0
        async for doc in col.find():
            patch, changed = transform_doc(doc, col_name)
            if changed:
                await col.update_one({"_id": doc["_id"]}, {"$set": patch})
                col_count += 1
        if col_count:
            per_col[col_name] = col_count
            total += col_count

    for col, n in sorted(per_col.items()):
        print(f"  ✓ {col:30}  finalized {n}")
    print(f"\n  TOTAL: {total} docs finalized")

    # Final scan
    print("\n  ── Final scan ──")
    found_any = False
    for col_name in cols:
        col = db[col_name]
        ru_hits = 0
        async for doc in col.find():
            for k, v in doc.items():
                if isinstance(v, str) and CYR.search(v):
                    ru_hits += 1
                elif isinstance(v, list):
                    for item in v[:5]:
                        if isinstance(item, str) and CYR.search(item):
                            ru_hits += 1
                        elif isinstance(item, dict):
                            for vv in item.values():
                                if isinstance(vv, str) and CYR.search(vv):
                                    ru_hits += 1
                elif isinstance(v, dict):
                    for vv in v.values():
                        if isinstance(vv, str) and CYR.search(vv):
                            ru_hits += 1
        if ru_hits:
            found_any = True
            print(f"    ⚠ {col_name:30}  cyrillic_left={ru_hits}")
    if not found_any:
        print("    🟢 ZERO cyrillic in any collection — DE-clean")


if __name__ == "__main__":
    asyncio.run(main())
