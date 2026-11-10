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

