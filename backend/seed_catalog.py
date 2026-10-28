PLAN_IDS = ["free", "basic", "pro", "team"]
COLLECTIONS = ["free", "basic", "pro", "premium", "exclusive"]
COLLECTION_PLANS = {"free": PLAN_IDS, "basic": ["basic", "pro", "team"], "pro": ["pro", "team"],
                    "premium": ["pro", "team"], "exclusive": ["team"]}
LAYOUTS = ["classic_athlete", "black_gold_elite", "legendary_edition", "neon_energy", "rookie_card",
           "mvp_edition", "minimal_professional", "esports_pro"]

# (id, name, badge, layout, collection, accent, description, recommended)
_T = [
    ("classic_athlete", "Classic Athlete", "CLASSIC", "classic_athlete", "free", "#3B82F6", "Varsity sash, stadium tones and dual-color stat boxes.", ["team", "racket"]),
    ("neon_energy", "Neon Energy", "NEON", "neon_energy", "free", "#00F0FF", "Cyber grid, angled photo cut and glowing stat pillars.", ["individual", "combat"]),
    ("rookie_card", "Rookie Card", "RC", "rookie_card", "free", "#F59E0B", "Vintage card stock, RC shield and season banner.", ["team"]),
    ("minimal_professional", "Minimal Professional", "PRO", "minimal_professional", "free", "#94A3B8", "Hairline grid, mono stats and zero fluff.", ["individual", "motorsport"]),
    ("esports_pro", "Esports Pro", "ESPORTS", "esports_pro", "free", "#C084FC", "Hex HUD mesh, hexagon portrait and KDA bars.", ["esports"]),
    ("classic_pitch", "Classic Pitch", "PITCH", "classic_athlete", "free", "#10B981", "Classic frame in turf green for ground sports.", ["team"]),
    ("rookie_crimson", "Rookie Crimson", "RC", "rookie_card", "basic", "#E11D48", "Rookie stock with a crimson season banner.", ["team"]),
    ("neon_magenta", "Neon Magenta", "NEON", "neon_energy", "basic", "#FF007F", "Neon grid tuned to hot magenta.", ["combat"]),
    ("minimal_slate", "Minimal Slate", "SLATE", "minimal_professional", "basic", "#E2E8F0", "Quiet slate layout with bright mono stats.", ["racket"]),
    ("classic_sunset", "Classic Sunset", "CLASSIC", "classic_athlete", "basic", "#F97316", "Classic sash with a warm sunset accent.", ["team"]),
    ("esports_ice", "Esports Ice", "HUD", "esports_pro", "basic", "#00F0FF", "Ice-blue HUD for battle royale squads.", ["esports"]),
    ("black_gold_elite", "Black and Gold Elite", "ELITE", "black_gold_elite", "pro", "#D4AF37", "Obsidian matte with gold-foil double frame and arched portrait.", []),
    ("elite_sapphire", "Elite Sapphire", "ELITE", "black_gold_elite", "pro", "#3B82F6", "Elite arch frame in sapphire foil.", []),
    ("neon_volt", "Neon Volt", "VOLT", "neon_energy", "pro", "#10B981", "High-voltage neon in electric green.", ["individual"]),
    ("esports_inferno", "Esports Inferno", "INFERNO", "esports_pro", "pro", "#F97316", "Fire-orange HUD for clutch players.", ["esports"]),
    ("minimal_gold", "Minimal Gold", "GOLD", "minimal_professional", "pro", "#D4AF37", "Minimal layout with gold detailing.", ["individual"]),
    ("legendary_edition", "Legendary Edition", "LEGENDARY", "legendary_edition", "premium", "#FBBF24", "Crimson halo, five-star crest and vertical legend mark.", []),
    ("mvp_edition", "MVP Edition", "MVP", "mvp_edition", "premium", "#FBBF24", "Crown watermark, platinum frame and golden spotlight.", []),
    ("legendary_ice", "Legendary Ice", "LEGEND", "legendary_edition", "premium", "#00F0FF", "Legend crest in frozen cyan.", []),
    ("mvp_platinum", "MVP Platinum", "MVP", "mvp_edition", "premium", "#E2E8F0", "Platinum MVP frame with cool spotlight.", []),
    ("elite_emerald", "Elite Emerald", "ELITE", "black_gold_elite", "premium", "#10B981", "Emerald foil on obsidian matte.", []),
    ("legendary_royal", "Legendary Royal", "ROYAL", "legendary_edition", "exclusive", "#8A2BE2", "Royal violet halo, reserved for squads.", []),
    ("mvp_crimson", "MVP Crimson", "MVP", "mvp_edition", "exclusive", "#E11D48", "Crimson crown edition for team captains.", []),
    ("elite_rose", "Elite Rose Gold", "ROSE", "black_gold_elite", "exclusive", "#FDA4AF", "Rose-gold foil, exclusive to Team.", []),
    ("esports_legend", "Esports Legend", "LEGEND", "esports_pro", "exclusive", "#FBBF24", "Gold HUD for championship rosters.", ["esports"]),
]
TEMPLATES = [{"id": i, "name": n, "badge": b, "layout": lay, "collection": c, "tier": c, "accent": a, "description": d,
              "recommended": rec, "plans": COLLECTION_PLANS[c], "sports": [], "watermark_free": True, "frame_image": "",
              "active": True, "order": k} for k, (i, n, b, lay, c, a, d, rec) in enumerate(_T)]


def _ent(**kw):
    base = {"remove_watermark": False, "saved_cards": 5, "photo_editing": True, "standard_backgrounds": True,
            "bg_removal": False, "bg_removal_limit": 0, "bg_library": False, "custom_backgrounds": False,
            "premium_backgrounds": False, "advanced_effects": False, "team_presets": False, "shared_branding": False}
    return {**base, **kw}


PLANS = [
    {"id": "free", "name": "Free", "type": "free", "price_month": 0, "price_year": 0, "cards_per_month": 2, "order": 0,
     "description": "Make your first cards with every photo-editing tool.",
     "features": ["2 card downloads a month", "Free template collection", "Crop, zoom, rotate & adjust photos", "Standard backgrounds", "Small RivalCard watermark"],
     "terms": "Free forever. No payment needed.", "entitlements": _ent()},
    {"id": "basic", "name": "Basic", "type": "subscription", "price_month": 18, "price_year": 180, "cards_per_month": 5, "order": 1,
     "description": "More cards, Basic templates and background removal.",
     "features": ["5 card downloads a month", "Free + Basic templates", "Background removal", "Background library", "No watermark"],
     "terms": "Pay per month or per year. No auto-renewal; renew any time.",
     "entitlements": _ent(remove_watermark=True, saved_cards=20, bg_removal=True, bg_removal_limit=10, bg_library=True)},
    {"id": "pro", "name": "Pro", "type": "subscription", "price_month": 45, "price_year": 450, "cards_per_month": 15, "order": 2,
     "description": "Pro & Premium designs, custom backgrounds and effects.",
     "features": ["15 card downloads a month", "Free, Basic, Pro & Premium templates", "Background removal", "Custom & premium backgrounds", "Advanced photo effects", "No watermark"],
     "terms": "Pay per month or per year. No auto-renewal; renew any time.",
     "entitlements": _ent(remove_watermark=True, saved_cards=100, bg_removal=True, bg_removal_limit=40, bg_library=True,
                          custom_backgrounds=True, premium_backgrounds=True, advanced_effects=True)},
    {"id": "team", "name": "Team", "type": "subscription", "price_month": 79, "price_year": 790, "cards_per_month": 40, "order": 3,
     "description": "Everything in Pro plus Exclusive designs and squad branding.",
     "features": ["40 card downloads a month", "All 25 templates incl. Exclusive", "Everything in Pro", "Team background presets", "Shared team branding"],
     "terms": "Pay per month or per year. No auto-renewal; renew any time.",
     "entitlements": _ent(remove_watermark=True, saved_cards=300, bg_removal=True, bg_removal_limit=120, bg_library=True,
                          custom_backgrounds=True, premium_backgrounds=True, advanced_effects=True, team_presets=True, shared_branding=True)},
]
for p in PLANS:
    p["active"] = True
    p["price_inr"] = p["price_month"]

_PX = "?auto=compress&cs=tinysrgb&w=900"
BACKGROUNDS = [
    {"id": "lib_stadium_night", "name": "Stadium night", "tier": "library", "type": "image", "value": "https://images.pexels.com/photos/14963646/pexels-photo-14963646.jpeg" + _PX},
    {"id": "lib_floodlights", "name": "Floodlights", "tier": "library", "type": "image", "value": "https://images.pexels.com/photos/15779126/pexels-photo-15779126.jpeg" + _PX},
    {"id": "lib_storm", "name": "Storm sky", "tier": "library", "type": "image", "value": "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=900&q=80"},
    {"id": "lib_stars", "name": "Star dust", "tier": "library", "type": "image", "value": "https://images.pexels.com/photos/9667550/pexels-photo-9667550.jpeg" + _PX},
    {"id": "pre_teal_streaks", "name": "Teal streaks", "tier": "premium", "type": "image", "value": "https://images.pexels.com/photos/23823961/pexels-photo-23823961.jpeg" + _PX},
    {"id": "pre_shadow_forest", "name": "Shadow light", "tier": "premium", "type": "image", "value": "https://images.pexels.com/photos/23824371/pexels-photo-23824371.jpeg" + _PX},
    {"id": "pre_dark_ripple", "name": "Dark ripple", "tier": "premium", "type": "image", "value": "https://images.pexels.com/photos/7505924/pexels-photo-7505924.jpeg" + _PX},
    {"id": "pre_gold_burst", "name": "Gold burst", "tier": "premium", "type": "gradient", "value": "radial-gradient(circle at 50% 30%,#FFF7D6,#D4AF37 35%,#3B2A05 75%,#000)"},
    {"id": "team_home", "name": "Home kit", "tier": "team", "type": "gradient", "value": "linear-gradient(135deg,#1E3A8A 0 50%,#F59E0B 50% 100%)"},
    {"id": "team_away", "name": "Away kit", "tier": "team", "type": "gradient", "value": "linear-gradient(135deg,#F8FAFC 0 50%,#E11D48 50% 100%)"},
    {"id": "team_hoops", "name": "Hoops", "tier": "team", "type": "gradient", "value": "repeating-linear-gradient(180deg,#065F46 0 22px,#F8FAFC 22px 44px)"},
    {"id": "team_sash", "name": "Captain sash", "tier": "team", "type": "gradient", "value": "linear-gradient(120deg,#0B0F17 0 40%,#D4AF37 40% 55%,#0B0F17 55%)"},
]
for i, b in enumerate(BACKGROUNDS):
    b.update(order=i, active=True)
BG_TIER_FEATURE = {"library": "bg_library", "premium": "premium_backgrounds", "team": "team_presets"}
