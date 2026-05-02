"""seed_de_cleanup.py — One-shot RU/UA → DE translator for demo seed data.

Walks every collection in `auto_platform`, finds strings containing Cyrillic,
and either:
  1. Maps them through DICT (curated DE-native copy for known terms).
  2. Falls back to PHRASE_FALLBACKS regex patterns.
  3. Leaves untouched and reports if no mapping found (so we can review).

Also:
  - Renames RU first/last names → DE equivalents.
  - Pins all demo orgs/branches to Berlin (lon=13.405, lat=52.52).
  - Updates bookings/quotes addresses to Berlin streets.
  - Sets demo focus zones: berlin-mitte / berlin-neukolln.

Idempotent: re-running won't double-translate anything.
"""
import asyncio
import re
import sys
from motor.motor_asyncio import AsyncIOMotorClient

CYR = re.compile(r'[А-Яа-яЁёІіЇїЄєҐґ]')

# ── 1. Hard-coded translations for repeated UI strings ────────────────
DICT = {
    # services / categories
    'Развал-схождение': 'Achsvermessung',
    'Замена масла': 'Ölwechsel',
    'Тормоза': 'Bremsen',
    'Тормозная система': 'Bremsanlage',
    'Замена тормозных колодок': 'Bremsbelag-Wechsel',
    'Диагностика': 'Diagnose',
    'Компьютерная диагностика': 'Computer-Diagnose',
    'Электрика': 'Elektrik',
    'Подвеска': 'Fahrwerk',
    'Шиномонтаж': 'Reifenservice',
    'Замена шин': 'Reifenwechsel',
    'Балансировка колёс': 'Auswuchten',
    'Балансировка колес': 'Auswuchten',
    'Кондиционер': 'Klimaanlage',
    'Заправка кондиционера': 'Klimaanlage befüllen',
    'Не заводится': 'Springt nicht an',
    'СТО': 'Werkstatt',
    'Автосервис': 'Werkstatt',
    'Кузовной ремонт': 'Karosseriereparatur',
    'Покраска': 'Lackierung',
    'Двигатель': 'Motor',
    'Ремонт двигателя': 'Motorreparatur',
    'Коробка передач': 'Getriebe',
    'АКПП': 'Automatikgetriebe',
    'МКПП': 'Schaltgetriebe',
    'Сцепление': 'Kupplung',
    'Замена сцепления': 'Kupplungswechsel',
    'Аккумулятор': 'Batterie',
    'Замена аккумулятора': 'Batteriewechsel',
    'Стартер': 'Anlasser',
    'Генератор': 'Lichtmaschine',
    'Фары': 'Scheinwerfer',
    'Замена лампочки': 'Glühbirnenwechsel',
    'Глушитель': 'Auspuff',
    'Выхлопная система': 'Abgasanlage',
    'Замена ремня ГРМ': 'Zahnriemen-Wechsel',
    'ТО': 'Inspektion',
    'Техосмотр': 'TÜV-Hauptuntersuchung',
    'Предпродажная проверка': 'Pre-Kauf-Check',
    'Проверка перед покупкой': 'Pre-Kauf-Check',

    # statuses / labels
    'Услуга': 'Service',
    'Заявка': 'Anfrage',
    'Заказ': 'Buchung',
    'Бронь': 'Buchung',
    'Бронирование': 'Buchung',
    'Активная': 'Aktiv',
    'Активный': 'Aktiv',
    'Завершено': 'Abgeschlossen',
    'Завершён': 'Abgeschlossen',
    'Отменено': 'Storniert',
    'В работе': 'In Bearbeitung',
    'Ожидает': 'Wartend',
    'Принято': 'Angenommen',
    'Подтверждено': 'Bestätigt',

    # generic phrases in descriptions
    'Хороший мастер': 'Guter Mechaniker',
    'Отличный сервис': 'Hervorragender Service',
    'Быстро и качественно': 'Schnell und sauber',
    'Рекомендую': 'Empfehlung',
    'Спасибо': 'Danke',
    'Пожалуйста': 'Bitte',
    'Цена': 'Preis',
    'Стоимость': 'Preis',
    'от': 'ab',
    'до': 'bis',
    'минут': 'Min.',
    'минута': 'Min.',
    'минуты': 'Min.',
    'мин': 'Min.',
    'часов': 'Std.',
    'часа': 'Std.',
    'час': 'Std.',
    'дней': 'Tage',
    'дня': 'Tage',
    'день': 'Tag',
    'км': 'km',
    'грн': 'EUR',
    '₴': '€',
    '₽': '€',

    # provider/org templates
    'Автомастер': 'Werkstatt',
    'Авторемонт': 'Autoreparatur',
    'Мастерская': 'Werkstatt',
    'Гараж': 'Werkstatt',
    'Профи': 'Profi',
    'Премиум': 'Premium',
    'Элит': 'Elite',
    'Центр': 'Zentrum',

    # cities (any RU spelling → DE)
    'Берлин': 'Berlin',
    'Митте': 'Mitte',
    'Нойкёльн': 'Neukölln',
    'Нойкельн': 'Neukölln',
    'Мюнхен': 'München',
    'Гамбург': 'Hamburg',
    'Киев': 'Berlin',          # remap demo Kyiv → Berlin
    'Київ': 'Berlin',
    'Москва': 'Berlin',

    # Russian street/address fragments → Berlin streets
    'ул.': '',
    'улица': '',
    'проспект': 'Allee',
    'просп.': 'Allee',
    'дом': '',
    'д.': '',
    'кв.': '',

    # Notification bodies
    'Новая заявка': 'Neue Anfrage',
    'Принять': 'Annehmen',
    'Отклонить': 'Ablehnen',
    'Просмотреть': 'Ansehen',
    'Открыть': 'Öffnen',

    # Names — first
    'Иван': 'Ivan',
    'Сергей': 'Stefan',
    'Александр': 'Alexander',
    'Алексей': 'Alex',
    'Дмитрий': 'Daniel',
    'Андрей': 'Andreas',
    'Михаил': 'Michael',
    'Николай': 'Nikolas',
    'Олег': 'Oliver',
    'Виталий': 'Viktor',
    'Игорь': 'Ingo',
    'Юрий': 'Jürgen',
    'Владимир': 'Wolfgang',
    'Анна': 'Anna',
    'Мария': 'Maria',
    'Ольга': 'Olga',
    'Татьяна': 'Tina',
    'Елена': 'Elena',
    'Наталья': 'Natalie',

    # Last names
    'Петров': 'Müller',
    'Иванов': 'Schmidt',
    'Сидоров': 'Schneider',
    'Кузнецов': 'Fischer',
    'Мастеров': 'Becker',
    'Смирнов': 'Weber',
    'Васильев': 'Wagner',
    'Попов': 'Hoffmann',
    'Соколов': 'Schäfer',
    'Лебедев': 'Koch',

    # Vehicle colors
    'Белый': 'Weiß',
    'Чёрный': 'Schwarz',
    'Черный': 'Schwarz',
    'Серый': 'Grau',
    'Красный': 'Rot',
    'Синий': 'Blau',
    'Зелёный': 'Grün',
    'Зеленый': 'Grün',
    'Жёлтый': 'Gelb',
    'Желтый': 'Gelb',
    'Серебристый': 'Silber',

    # workhours patterns
    'Пн-Пт': 'Mo-Fr',
    'Пн-Сб': 'Mo-Sa',
    'Пн-Вс': 'Mo-So',
    'круглосуточно': '24/7',
    'выходной': 'geschlossen',
}

# ── 2. Regex fallbacks for templated strings ──────────────────────────
PHRASE_RX = [
    # "Заявка №123 принята" → "Anfrage #123 angenommen"
    (re.compile(r'Заявка\s*№?\s*(\d+)'),  r'Anfrage #\1'),
    (re.compile(r'Заказ\s*№?\s*(\d+)'),    r'Buchung #\1'),
    (re.compile(r'(\d+)\s*грн'),            r'€\1'),
    (re.compile(r'около\s+(\d+)\s*мин'),    r'ca. \1 Min.'),
    (re.compile(r'через\s+(\d+)\s*мин'),    r'in \1 Min.'),
    (re.compile(r'через\s+(\d+)\s*ч'),      r'in \1 Std.'),
]

# Berlin demo addresses to replace any RU address
BERLIN_ADDRESSES = [
    "Friedrichstraße 100, 10117 Berlin Mitte",
    "Karl-Marx-Straße 220, 12055 Berlin Neukölln",
    "Hermannstraße 50, 12049 Berlin Neukölln",
    "Torstraße 100, 10119 Berlin Mitte",
    "Alexanderplatz 7, 10178 Berlin Mitte",
    "Sonnenallee 130, 12059 Berlin Neukölln",
]

# Generic DE review texts
DE_REVIEWS = [
    "Sehr professionelle Arbeit. Schnell und transparent.",
    "Faire Preise, ehrliche Diagnose. Komme wieder.",
    "TÜV-Beratung war top. Empfehlung.",
    "Termin pünktlich, Auto sauber zurück.",
    "Sehr freundlich und kompetent.",
    "Hat mir zwei versteckte Mängel gezeigt — sehr ehrlich.",
    "Pre-Kauf-Check war Geld wert. Hat mich vor Fehlkauf bewahrt.",
]


def translate_string(s: str, ctx: dict) -> str:
    """Apply DICT then PHRASE_RX. Returns translated string (idempotent)."""
    if not s or not CYR.search(s):
        return s
    out = s
    # 1. Multi-word phrases first (longest keys)
    for k in sorted(DICT.keys(), key=len, reverse=True):
        if k and k in out:
            out = out.replace(k, DICT[k])
    # 2. Regex fallbacks
    for rx, repl in PHRASE_RX:
        out = rx.sub(repl, out)
    # 3. If still has Cyrillic, log for review
    if CYR.search(out):
        ctx.setdefault('untranslated', []).append(out[:120])
    return out


def transform_value(v, ctx, key=None):
    """Recursively transform any string in nested structures."""
    if isinstance(v, str):
        return translate_string(v, ctx)
    if isinstance(v, list):
        return [transform_value(x, ctx, key) for x in v]
    if isinstance(v, dict):
        return {k: transform_value(val, ctx, k) for k, val in v.items()}
    return v


async def main():
    c = AsyncIOMotorClient("mongodb://localhost:27017")
    db = c["auto_platform"]
    ctx: dict = {}
    total_updated = 0
    cols = await db.list_collection_names()

    for col_name in cols:
        col = db[col_name]
        cnt = await col.count_documents({})
        if cnt == 0:
            continue
        col_updated = 0
        async for doc in col.find():
            doc_id = doc.get("_id")
            new_doc = {}
            changed = False
            for k, v in doc.items():
                if k == "_id":
                    continue
                nv = transform_value(v, ctx, k)
                if nv != v:
                    changed = True
                    new_doc[k] = nv
            if changed:
                await col.update_one({"_id": doc_id}, {"$set": new_doc})
                col_updated += 1
        if col_updated:
            print(f"  ✓ {col_name:30} updated {col_updated}/{cnt}")
        total_updated += col_updated

    # ── Special pass: replace bookings/quotes addresses & coordinates ─
    import random
    random.seed(42)
    for col_name in ("bookings", "quotes", "branches", "organizations"):
        col = db[col_name]
        async for doc in col.find():
            update = {}
            addr = doc.get("address") or ""
            if isinstance(addr, str) and (CYR.search(addr) or "Berlin" not in addr and len(addr) < 30):
                update["address"] = random.choice(BERLIN_ADDRESSES)
            if "city" in doc and doc["city"] != "Berlin":
                update["city"] = "Berlin"
            if "country" in doc and doc["country"] not in ("DE", "Germany"):
                update["country"] = "DE"
            if "currency" in doc and doc["currency"] not in ("EUR", "€"):
                update["currency"] = "EUR"
            # Pin demo location to Berlin (Mitte ± small jitter)
            if "location" in doc and isinstance(doc["location"], dict):
                update["location"] = {
                    "type": "Point",
                    "coordinates": [
                        13.405 + random.uniform(-0.04, 0.04),
                        52.52 + random.uniform(-0.03, 0.03),
                    ],
                }
            if update:
                await col.update_one({"_id": doc["_id"]}, {"$set": update})

    # ── Replace bookings serviceName / orgName explicit ───────────────
    # (DICT may have caught most; this hits any literal RU still left)
    bk = db["bookings"]
    async for doc in bk.find():
        if doc.get("serviceName") and CYR.search(doc["serviceName"] or ""):
            await bk.update_one(
                {"_id": doc["_id"]},
                {"$set": {"serviceName": "Bremsen-Diagnose"}},
            )

    # ── Reviews: replace any leftover RU text with curated DE reviews ──
    rv = db["reviews"]
    async for doc in rv.find():
        text = doc.get("text") or ""
        if CYR.search(text):
            await rv.update_one(
                {"_id": doc["_id"]},
                {"$set": {"text": random.choice(DE_REVIEWS)}},
            )

    # ── Quick-requests echoText ───────────────────────────────────────
    qr = db["quick_requests"]
    async for doc in qr.find():
        et = doc.get("echoText") or ""
        if CYR.search(et):
            await qr.update_one(
                {"_id": doc["_id"]},
                {
                    "$set": {
                        "echoText": "Wir suchen 3 Werkstätten in Berlin Mitte für Sie — beste Antwortzeit ~6 Min.",
                    }
                },
            )

    # ── Final report ──────────────────────────────────────────────────
    print(f"\n  Total docs updated: {total_updated}")
    if ctx.get("untranslated"):
        print(f"\n  ⚠ {len(ctx['untranslated'])} strings still have cyrillic (samples):")
        for s in ctx["untranslated"][:15]:
            print(f"    - {s}")

    # Final scan
    print("\n  ── Re-scan after cleanup ──")
    summary = []
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
        if ru_hits:
            summary.append((col_name, ru_hits))
    if summary:
        for col_name, hits in summary:
            print(f"    {col_name:30}  cyrillic_left={hits}")
    else:
        print("    ✓ ZERO cyrillic anywhere")


if __name__ == "__main__":
    asyncio.run(main())
