import re


def _slug(s):
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


def _sport(name, category, kind, stats, position="Position", sid=None):
    return {
        "id": sid or _slug(name),
        "name": name,
        "category": category,
        "kind": kind,
        "position_label": position,
        "stats": [{"key": _slug(s), "label": s} for s in stats],
        "active": True,
    }


T, I, E = "team", "individual", "esports"
ESPORTS_STATS = ["Matches", "Wins", "K/D Ratio", "Rank", "Avg Damage", "MVPs"]

_RAW = [
    # team
    ("Cricket", "team", T, ["Matches", "Runs", "Wickets", "Highest Score", "Batting Avg", "Strike Rate"], "Role"),
    ("Football / Soccer", "team", T, ["Matches", "Goals", "Assists", "Clean Sheets", "Pass Acc %", "Tackles"], "Position", "football"),
    ("Basketball", "team", T, ["Games", "Points", "Rebounds", "Assists", "Steals", "Blocks"]),
    ("Volleyball", "team", T, ["Matches", "Points", "Blocks", "Aces", "Digs", "Kills"]),
    ("Rugby", "team", T, ["Matches", "Tries", "Conversions", "Tackles", "Carries", "Points"]),
    ("Hockey", "team", T, ["Matches", "Goals", "Assists", "Saves", "Penalty Corners", "Tackles"]),
    ("Baseball", "team", T, ["Games", "Batting Avg", "Home Runs", "RBIs", "ERA", "Strikeouts"]),
    ("Softball", "team", T, ["Games", "Batting Avg", "Home Runs", "RBIs", "ERA", "Strikeouts"]),
    ("Handball", "team", T, ["Matches", "Goals", "Assists", "Saves", "Steals", "Shot %"]),
    ("Kabaddi", "team", T, ["Matches", "Raid Points", "Tackle Points", "Super Raids", "Super Tackles", "High 5s"], "Role"),
    ("Kho-kho", "team", T, ["Matches", "Tag Points", "Defence Time", "Dives", "Wins", "Awards"], "Role"),
    ("Netball", "team", T, ["Matches", "Goals", "Shot %", "Interceptions", "Rebounds", "Feeds"]),
    ("Futsal", "team", T, ["Matches", "Goals", "Assists", "Saves", "Clean Sheets", "Tackles"]),
    ("American Football", "team", T, ["Games", "Touchdowns", "Yards", "Tackles", "Sacks", "Interceptions"]),
    ("Water Polo", "team", T, ["Matches", "Goals", "Assists", "Steals", "Saves", "Exclusions Won"]),
    ("Ultimate Frisbee", "team", T, ["Games", "Goals", "Assists", "Blocks", "Completions", "Turnovers"]),
    # racket
    ("Badminton", "racket", I, ["Matches", "Wins", "Losses", "Ranking", "Titles", "Smash Speed"], "Event"),
    ("Tennis", "racket", I, ["Matches", "Wins", "Titles", "Ranking", "Aces", "Win %"], "Event"),
    ("Table Tennis", "racket", I, ["Matches", "Wins", "Losses", "Ranking", "Titles", "Rating"], "Event"),
    ("Squash", "racket", I, ["Matches", "Wins", "Losses", "Ranking", "Titles", "Win %"], "Event"),
    ("Pickleball", "racket", I, ["Matches", "Wins", "DUPR Rating", "Titles", "Ranking", "Win %"], "Event"),
    ("Padel", "racket", I, ["Matches", "Wins", "Ranking", "Titles", "Win %", "Partner"], "Side"),
    # combat
    ("Boxing", "combat", I, ["Bouts", "Wins", "Losses", "KOs", "Weight Class", "Reach"], "Weight Class"),
    ("Wrestling", "combat", I, ["Bouts", "Wins", "Pins", "Medals", "Weight Class", "Takedowns"], "Style"),
    ("Judo", "combat", I, ["Bouts", "Wins", "Ippons", "Medals", "Weight Class", "Belt"], "Belt"),
    ("Karate", "combat", I, ["Bouts", "Wins", "Medals", "Belt", "Kata Score", "Kumite Wins"], "Belt"),
    ("Taekwondo", "combat", I, ["Bouts", "Wins", "Medals", "Belt", "Weight Class", "Points"], "Belt"),
    ("Mixed Martial Arts", "combat", I, ["Fights", "Wins", "KO/TKO", "Submissions", "Weight Class", "Reach"], "Weight Class", "mma"),
    ("Fencing", "combat", I, ["Bouts", "Wins", "Touches", "Medals", "Ranking", "Weapon"], "Weapon"),
    # individual / athletic
    ("Athletics", "individual", I, ["Event", "Personal Best", "Season Best", "Competition", "Medals", "Ranking"], "Event"),
    ("Running", "individual", I, ["Distance", "Personal Best", "Season Best", "Races", "Podiums", "Pace"], "Event"),
    ("Marathon", "individual", I, ["Marathons", "Personal Best", "Season Best", "Half PB", "Podiums", "Avg Pace"], "Event"),
    ("Swimming", "individual", I, ["Event", "Distance", "Time", "Personal Best", "Medals", "Ranking"], "Stroke"),
    ("Cycling", "individual", I, ["Races", "Wins", "Distance", "FTP", "Podiums", "Best Time"], "Discipline"),
    ("Weightlifting", "individual", I, ["Snatch", "Clean & Jerk", "Total", "Weight Class", "Medals", "Ranking"], "Weight Class"),
    ("Powerlifting", "individual", I, ["Squat", "Bench", "Deadlift", "Total", "Weight Class", "Wilks"], "Weight Class"),
    ("Gymnastics", "individual", I, ["Apparatus", "Best Score", "All-Around", "Medals", "Competitions", "Ranking"], "Apparatus"),
    ("Archery", "individual", I, ["Bow Type", "Best Score", "X Count", "Medals", "Ranking", "Distance"], "Bow Type"),
    ("Shooting Sports", "individual", I, ["Event", "Best Score", "Avg Score", "Medals", "Ranking", "Competitions"], "Event", "shooting"),
    ("Triathlon", "individual", I, ["Races", "Best Time", "Swim", "Bike", "Run", "Podiums"], "Distance"),
    ("Rowing", "individual", I, ["Boat Class", "2K Time", "Races", "Medals", "Ranking", "Split"], "Boat Class"),
    ("Skateboarding", "individual", I, ["Discipline", "Best Score", "Contests", "Podiums", "Signature Trick", "Ranking"], "Stance"),
    ("Surfing", "individual", I, ["Heats", "Best Wave", "Heat Wins", "Podiums", "Ranking", "Home Break"], "Stance"),
    ("Golf", "individual", I, ["Rounds", "Handicap", "Best Score", "Avg Score", "Birdies", "Wins"], "Tour"),
    ("Chess", "individual", I, ["Rating", "Title", "Federation", "Rapid", "Blitz", "Tournaments Won"], "Title"),
    # motorsport & other
    ("Karting", "motorsport", I, ["Races", "Wins", "Podiums", "Poles", "Fastest Laps", "Class"], "Class"),
    ("Formula Racing", "motorsport", I, ["Races", "Wins", "Podiums", "Poles", "Points", "Fastest Laps"], "Series"),
    ("Motorsport", "motorsport", I, ["Races", "Wins", "Podiums", "Championships", "Best Lap", "Class"], "Class"),
    ("Equestrian", "motorsport", I, ["Discipline", "Horse", "Competitions", "Wins", "Best Score", "Ranking"], "Discipline"),
    ("Winter Sports", "motorsport", I, ["Discipline", "Races", "Best Time", "Podiums", "Medals", "Ranking"], "Discipline"),
    ("Adventure Sports", "motorsport", I, ["Discipline", "Expeditions", "Highest Point", "Records", "Events", "Years Active"], "Discipline"),
    # esports
    ("BGMI", "esports", E, ["Matches", "F/D Ratio", "Avg Damage", "Headshot %", "Wins", "Top 10s"], "Role"),
    ("Free Fire", "esports", E, ["Matches", "K/D Ratio", "Booyahs", "Headshot %", "Avg Damage", "Rank"], "Role"),
    ("Valorant", "esports", E, ["ACS", "K/D Ratio", "HS %", "ADR", "First Kills", "Clutch %"], "Agent Role"),
    ("Counter-Strike", "esports", E, ["Maps", "K/D Ratio", "ADR", "HS %", "Rating", "Clutches"], "Role"),
    ("Dota 2", "esports", E, ["Matches", "Win %", "KDA", "GPM", "XPM", "MMR"], "Position"),
    ("League of Legends", "esports", E, ["Games", "Win %", "KDA", "CS/min", "Vision Score", "Rank"], "Lane"),
    ("Fortnite", "esports", E, ["Matches", "Wins", "Kills", "K/D Ratio", "Top 10s", "Arena Points"], "Role"),
    ("EA Sports FC", "esports", E, ["Matches", "Wins", "Goals", "Division", "Win %", "Clean Sheets"], "Mode"),
    ("Other Esports", "esports", E, ESPORTS_STATS, "Role"),
]

SPORTS = [dict(_sport(*r), order=i) for i, r in enumerate(_RAW)]

TEMPLATES = [
    {"id": "classic_athlete", "name": "Classic Athlete", "badge": "CLASSIC", "tier": "free", "layout": "classic_athlete",
     "description": "Varsity sash, stadium tones and dual-color stat boxes.", "accent": "#3B82F6", "recommended": ["team", "racket"]},
    {"id": "black_gold_elite", "name": "Black and Gold Elite", "badge": "ELITE", "tier": "premium", "layout": "black_gold_elite",
     "description": "Obsidian matte with gold-foil double frame and arched portrait.", "accent": "#D4AF37", "recommended": []},
    {"id": "legendary_edition", "name": "Legendary Edition", "badge": "LEGENDARY", "tier": "premium", "layout": "legendary_edition",
     "description": "Crimson halo, five-star crest and vertical legend mark.", "accent": "#FBBF24", "recommended": []},
    {"id": "neon_energy", "name": "Neon Energy", "badge": "NEON", "tier": "free", "layout": "neon_energy",
     "description": "Cyber grid, angled photo cut and glowing stat pillars.", "accent": "#00F0FF", "recommended": ["individual", "combat"]},
    {"id": "rookie_card", "name": "Rookie Card", "badge": "RC", "tier": "free", "layout": "rookie_card",
     "description": "Vintage card stock, RC shield and season banner.", "accent": "#F59E0B", "recommended": ["team"]},
    {"id": "mvp_edition", "name": "MVP Edition", "badge": "MVP", "tier": "premium", "layout": "mvp_edition",
     "description": "Crown watermark, platinum frame and golden spotlight.", "accent": "#FBBF24", "recommended": []},
    {"id": "minimal_professional", "name": "Minimal Professional", "badge": "PRO", "tier": "free", "layout": "minimal_professional",
     "description": "Hairline grid, mono stats and zero fluff.", "accent": "#94A3B8", "recommended": ["individual", "motorsport"]},
    {"id": "esports_pro", "name": "Esports Pro", "badge": "ESPORTS", "tier": "free", "layout": "esports_pro",
     "description": "Hex HUD mesh, hexagon portrait and KDA bars.", "accent": "#C084FC", "recommended": ["esports"]},
]
for i, t in enumerate(TEMPLATES):
    t.update(order=i, active=True, sports=[], watermark_free=True)

LAYOUTS = [t["layout"] for t in TEMPLATES]
PREMIUM_IDS = [t["id"] for t in TEMPLATES if t["tier"] == "premium"]

PLANS = [
    {"id": "free", "name": "Free", "type": "free", "price_inr": 0, "interval": "none", "default_days": None, "trial_days": 0,
     "description": "Create and download player cards with all basic templates.",
     "features": ["All 5 basic templates", "Card + story PNG export", "Small RivalCard watermark", "Save up to 5 cards (account)"],
     "entitlements": {"all_premium_templates": False, "premium_template_choices": 0, "remove_watermark": False, "saved_cards": 5, "team_cards": 0},
     "eligible_templates": [], "terms": "Free forever. No payment needed.", "order": 0},
    {"id": "premium_card", "name": "Premium Card", "type": "one_time", "price_inr": 49, "interval": "none", "default_days": None, "trial_days": 0,
     "description": "Unlock one premium design of your choice, forever.",
     "features": ["1 premium template of your choice", "No watermark", "Save up to 10 cards"],
     "entitlements": {"all_premium_templates": False, "premium_template_choices": 1, "remove_watermark": True, "saved_cards": 10, "team_cards": 0},
     "eligible_templates": PREMIUM_IDS, "terms": "One-time purchase, no renewal. Refunds within 7 days if the design was not exported.", "order": 1},
    {"id": "pro_creator", "name": "Pro Creator", "type": "subscription", "price_inr": 149, "interval": "month", "default_days": 30, "trial_days": 0,
     "description": "Every premium template and full customization.",
     "features": ["All premium templates", "No watermark", "Save up to 200 cards", "Priority support"],
     "entitlements": {"all_premium_templates": True, "premium_template_choices": 0, "remove_watermark": True, "saved_cards": 200, "team_cards": 0},
     "eligible_templates": PREMIUM_IDS, "terms": "Renews monthly. Cancel anytime; access continues until the end of the paid period.", "order": 2},
    {"id": "team_pack", "name": "Team Pack", "type": "team", "price_inr": 999, "interval": "none", "default_days": 365, "trial_days": 0,
     "description": "Matching cards for your whole squad with a shared team theme.",
     "features": ["20 team player cards", "All premium templates", "Shared team theme", "No watermark", "Valid 12 months"],
     "entitlements": {"all_premium_templates": True, "premium_template_choices": 0, "remove_watermark": True, "saved_cards": 50, "team_cards": 20},
     "eligible_templates": PREMIUM_IDS, "terms": "One-time package valid for 12 months. No auto-renewal.", "order": 3},
]
for p in PLANS:
    p["active"] = True
