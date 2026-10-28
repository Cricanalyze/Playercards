export const CARD_W = 360;
export const CARD_H = 504;
export const STORY_H = 640;

export const ACCENTS = ["#D4AF37", "#3B82F6", "#00F0FF", "#FF007F", "#8A2BE2", "#10B981", "#F97316", "#E11D48", "#E2E8F0"];

export const CATEGORY_LABELS = {
  team: "Team Sports", racket: "Racket & Court", combat: "Combat", individual: "Individual & Athletic",
  motorsport: "Motorsport & Outdoor", esports: "Esports & Gaming",
};

export const defaultShow = (kind) => ({
  nickname: true, team: kind !== "individual", jersey: kind === "team", position: true, country: true,
  season: true, rating: true, achievements: true, tagline: true, social: false, stats: true,
});

export const blankData = (sport) => ({
  name: "", nickname: "", team: "", jersey: "", position: "", country: "", season: String(new Date().getFullYear()),
  rating: "", achievements: [], tagline: "", social: "", accent: "",
  stats: {}, statKeys: (sport?.stats || []).slice(0, 6).map((s) => s.key), show: defaultShow(sport?.kind || "team"),
});

export const blankPhoto = { src: "", zoom: 1, x: 0, y: 0, rotate: 0, brightness: 1, contrast: 1, saturate: 1, effect: "none", cutout: "", useCutout: false, bg: { type: "none", value: "" } };

export const EFFECTS = {
  none: "", vivid: "saturate(1.5) contrast(1.15)", noir: "grayscale(1) contrast(1.3)", vintage: "sepia(.55) contrast(1.05) brightness(1.05)",
  glow: "brightness(1.12) drop-shadow(0 0 10px rgba(255,215,120,.85))", duotone: "grayscale(1) sepia(1) hue-rotate(190deg) saturate(3)", cold: "hue-rotate(-15deg) saturate(1.2) brightness(1.05)",
};

export const photoFilter = (p) =>
  [`brightness(${p.brightness ?? 1})`, `contrast(${p.contrast ?? 1})`, `saturate(${p.saturate ?? 1})`, EFFECTS[p.effect] || ""].join(" ");

const BG_FEATURE = { library: "bg_library", premium: "premium_backgrounds", team: "team_presets" };
export const featuresUsed = (p) => [
  p.bg?.custom && p.bg?.type === "image" ? "custom_backgrounds" : "",
  BG_FEATURE[p.bg?.tier] && p.bg?.type !== "none" ? BG_FEATURE[p.bg.tier] : "",
  p.effect && p.effect !== "none" ? "advanced_effects" : "",
].filter(Boolean);

export const BG_PRESETS = [
  { type: "gradient", value: "linear-gradient(160deg,#0F172A,#1E3A8A)", label: "Night blue" },
  { type: "gradient", value: "linear-gradient(160deg,#111,#B38728)", label: "Black gold" },
  { type: "gradient", value: "linear-gradient(160deg,#4C0519,#E11D48)", label: "Crimson" },
  { type: "gradient", value: "linear-gradient(160deg,#050515,#00F0FF)", label: "Neon cyan" },
  { type: "gradient", value: "linear-gradient(160deg,#2E1065,#C084FC)", label: "Purple haze" },
  { type: "gradient", value: "radial-gradient(circle at 50% 35%,#FDE68A,#F59E0B 45%,#78350F)", label: "Spotlight" },
  { type: "gradient", value: "repeating-linear-gradient(135deg,#0B0F17 0 14px,#1A2234 14px 28px)", label: "Stripes" },
  { type: "gradient", value: "linear-gradient(180deg,#065F46,#10B981)", label: "Pitch green" },
];

export const DEMO_PLAYERS = [
  { sport: "cricket", template: "legendary_edition", photo: "https://images.unsplash.com/photo-1599982946086-eb42d9e14eb8?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    data: { name: "Arjun Mehra", nickname: "The Wall", team: "Coastal Kings XI", jersey: "18", position: "Top-order Batter", country: "Demo", season: "2026", rating: "93",
      tagline: "Built for the long innings.", achievements: ["Player of the Series (fictional)"], stats: { matches: "72", runs: "3,184", wickets: "14", highest_score: "176*", batting_avg: "52.4", strike_rate: "138.6" } } },
  { sport: "basketball", template: "black_gold_elite", photo: "https://images.pexels.com/photos/20615453/pexels-photo-20615453.jpeg?auto=compress&cs=tinysrgb&w=800",
    data: { name: "Marcus Vance", nickname: "The Engine", team: "Harbor City Hawks", jersey: "23", position: "Shooting Guard", country: "Demo", season: "2026", rating: "91",
      tagline: "Clutch in the fourth.", achievements: ["League MVP (fictional)"], stats: { games: "64", points: "1,712", rebounds: "402", assists: "388", steals: "97", blocks: "31" } } },
  { sport: "football", template: "neon_energy", photo: "https://images.unsplash.com/photo-1517466787929-bc90951d0974?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    data: { name: "Julian Ortega", nickname: "Rayo", team: "Riverside FC", jersey: "9", position: "Striker", country: "Demo", season: "2026", rating: "88",
      tagline: "Every touch a threat.", achievements: ["Golden Boot (fictional)"], stats: { matches: "38", goals: "27", assists: "11", clean_sheets: "0", pass_acc: "82%", tackles: "19" } } },
  { sport: "valorant", template: "esports_pro", photo: "https://images.unsplash.com/photo-1542751371-adc38448a05e?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    data: { name: "Alex Chen", nickname: "VORTEX", team: "Nightfall Esports", jersey: "", position: "Duelist", country: "Demo", season: "S2", rating: "IMM 3",
      tagline: "First in. Last standing.", achievements: ["LAN Champion (fictional)"], stats: { acs: "276", k_d_ratio: "1.42", hs: "31%", adr: "171", first_kills: "212", clutch: "24%" } } },
  { sport: "tennis", template: "minimal_professional", photo: "https://images.unsplash.com/photo-1595435742656-5272d0b3fa82?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    data: { name: "Elena Rostova", nickname: "", team: "", jersey: "", position: "Singles", country: "Demo", season: "2026", rating: "#14",
      tagline: "Baseline to glory.", achievements: ["3 club titles (fictional)"], stats: { matches: "52", wins: "41", titles: "3", ranking: "14", aces: "286", win: "79%" } } },
];

export const demoFor = (i, sports) => {
  const d = DEMO_PLAYERS[i % DEMO_PLAYERS.length];
  const sport = sports.find((s) => s.id === d.sport) || sports[0];
  return { sport, templateId: d.template, photo: { ...blankPhoto, src: d.photo }, data: { ...blankData(sport), ...d.data, show: { ...defaultShow(sport?.kind), social: false } } };
};

export const fitSize = (text, base, maxChars, min = 14) => {
  const len = (text || "").length;
  if (len <= maxChars) return base;
  return Math.max(min, Math.round((base * maxChars) / len));
};

export const toNum = (v) => {
  const n = parseFloat(String(v || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_MB = 10;

export async function processPhoto(file) {
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error("Please upload a JPG, PNG or WebP image.");
  if (file.size > MAX_MB * 1024 * 1024) throw new Error(`That image is over ${MAX_MB} MB. Please choose a smaller one.`);
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("We couldn't read that image. Try another file.")); i.src = url; });
    if (img.width < 200 || img.height < 200) throw new Error("Image is too small. Use at least 200×200 pixels.");
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.92);
  } finally { URL.revokeObjectURL(url); }
}
