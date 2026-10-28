import { useEffect, useRef, useState } from "react";
import { Lock, Upload, Trash2, RefreshCw, ZoomIn, Wand2, Loader2, ImageIcon, RotateCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ACCENTS, MAX_MB, processPhoto, blankPhoto, BG_PRESETS, EFFECTS } from "@/lib/cardUtils";
import { removeBackground } from "@/lib/bgRemoval";
import { useApi, errMsg, newRequestId } from "@/lib/api";
import { useAppData } from "@/context/AppData";

const upgradeToast = (msg) => toast.error(msg, { action: { label: "See plans", onClick: () => window.location.assign("/pricing") } });

const SLIDERS = [
  ["zoom", "Zoom", 0.5, 3, 0.02], ["rotate", "Rotate", -180, 180, 1], ["x", "Left / right", -50, 50, 0.5], ["y", "Up / down", -50, 50, 0.5],
  ["brightness", "Brightness", 0.5, 1.5, 0.01], ["contrast", "Contrast", 0.5, 1.5, 0.01], ["saturate", "Saturation", 0, 2, 0.01],
];

const Adjust = ({ photo, setPhoto }) => (
  <div className="space-y-4">
    {SLIDERS.map(([k, l, min, max, step]) => (
      <div key={k} className="space-y-2">
        <Label className="flex items-center gap-2 text-xs uppercase tracking-wider">{k === "zoom" && <ZoomIn className="w-3 h-3" />}{k === "rotate" && <RotateCw className="w-3 h-3" />}{l}
          <span className="ml-auto font-mono text-muted-foreground">{k === "rotate" ? `${photo[k] ?? 0}°` : Number(photo[k] ?? blankPhoto[k]).toFixed(k === "x" || k === "y" ? 0 : 2)}</span></Label>
        <Slider data-testid={`photo-${k}-slider`} min={min} max={max} step={step} value={[photo[k] ?? blankPhoto[k]]} onValueChange={(v) => setPhoto({ ...photo, [k]: v[0] }, false)} />
      </div>
    ))}
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" className="rounded-full" onClick={() => setPhoto({ ...photo, rotate: ((photo.rotate || 0) + 90 + 180) % 360 - 180 })} data-testid="photo-rotate-90-button"><RotateCw className="w-4 h-4 mr-1" />Rotate 90°</Button>
      <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setPhoto({ ...photo, brightness: 1, contrast: 1, saturate: 1, rotate: 0 })} data-testid="photo-reset-adjust-button">Reset adjustments</Button>
    </div>
    <p className="text-xs text-muted-foreground">Tip: drag directly on the card preview to move the photo. Zoom out or rotate to reveal the background.</p>
  </div>
);

const Effects = ({ photo, setPhoto, ent }) => {
  const ok = !!ent?.features?.advanced_effects;
  return (
    <div className="space-y-2 border-t border-border pt-5" data-testid="effects-section">
      <p className="font-semibold text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-500" />Advanced effects {!ok && <span className="text-[10px] font-bold uppercase bg-amber-500 text-slate-950 px-1.5 rounded">Pro</span>}</p>
      <div className="flex flex-wrap gap-2">
        {Object.keys(EFFECTS).map((k) => (
          <button key={k} data-testid={`effect-${k}`} onClick={() => (ok || k === "none" ? setPhoto({ ...photo, effect: k }) : upgradeToast("Advanced effects are included in Pro and Team."))}
            className={`h-8 px-3 rounded-full border text-xs font-semibold capitalize inline-flex items-center gap-1 transition-colors ${(photo.effect || "none") === k ? "border-amber-500 bg-amber-500/10" : "border-border hover:border-amber-500/50"} ${!ok && k !== "none" ? "opacity-60" : ""}`}>
            {!ok && k !== "none" && <Lock className="w-3 h-3" />}{k}</button>
        ))}
      </div>
    </div>
  );
};

const NEED = { library: "Basic", premium: "Pro", team: "Team" };

function useBackgrounds(planId) {
  const api = useApi();
  const [list, setList] = useState([]);
  useEffect(() => { api("get", "/backgrounds").then(setList).catch(() => setList([])); }, [api, planId]);
  return list;
}

const BackgroundSection = ({ photo, setPhoto, ent }) => {
  const api = useApi();
  const { refreshMe, isSignedIn } = useAppData();
  const library = useBackgrounds(ent?.plan_id);
  const [busy, setBusy] = useState(false);
  const pendingId = useRef("");
  const bgInput = useRef(null);
  const f = ent?.features || {};
  const run = async () => {
    if (!isSignedIn) return upgradeToast("Sign in and choose Basic or higher to remove backgrounds.");
    if (!f.bg_removal) return upgradeToast("Background removal is included in Basic, Pro and Team.");
    setBusy(true);
    pendingId.current = pendingId.current || newRequestId();
    try {
      await api("post", "/tools/bg-removal", { request_id: pendingId.current });
      refreshMe();
    } catch (e) { setBusy(false); return e?.response?.status === 402 ? upgradeToast(errMsg(e)) : toast.error(errMsg(e)); }
    try { setPhoto({ ...photo, cutout: await removeBackground(photo.src), useCutout: true }); pendingId.current = ""; toast.success("Background removed. Pick a new background below."); }
    catch { toast.error("Background removal didn't work on this device. Retrying won't use another credit."); }
    finally { setBusy(false); }
  };
  const setBg = (bg) => setPhoto({ ...photo, bg });
  const onBgFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try { setBg({ type: "image", value: await processPhoto(file), custom: true }); } catch (err) { toast.error(err.message); }
  };
  const isOn = (b) => photo.bg?.type === b.type && photo.bg?.value === b.value;
  const sw = "w-10 h-10 rounded-lg border-2 transition-transform hover:scale-110";
  return (
    <div className="space-y-4 border-t border-border pt-5" data-testid="background-section">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-sm flex items-center gap-2"><Wand2 className="w-4 h-4 text-amber-500" />Background</p>
          <p className="text-xs text-muted-foreground">Removal runs on your device — the photo is never uploaded. {f.bg_removal ? `${ent.bg_removals_remaining} of ${ent.bg_removal_limit} removals left this month.` : "Included in Basic and above."}</p>
        </div>
        {photo.cutout
          ? <label className="flex items-center gap-2 text-sm shrink-0">Cutout<Switch data-testid="bg-cutout-switch" checked={photo.useCutout} onCheckedChange={(v) => setPhoto({ ...photo, useCutout: v })} /></label>
          : <Button onClick={run} disabled={busy} variant="outline" className="rounded-full shrink-0" data-testid="bg-remove-button">{busy ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Removing…</> : <>{!f.bg_removal && <Lock className="w-3 h-3 mr-1" />}Remove background</>}</Button>}
      </div>
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Standard</p>
        <div className="flex flex-wrap gap-2">
          <button data-testid="bg-option-none" onClick={() => setBg({ type: "none", value: "" })} className={`${sw} text-[9px] font-bold uppercase ${photo.bg?.type === "none" ? "border-amber-500" : "border-border"}`}>Card</button>
          {BG_PRESETS.map((b, i) => <button key={b.label} data-testid={`bg-preset-${i}`} aria-label={b.label} title={b.label} onClick={() => setBg(b)} className={`${sw} ${isOn(b) ? "border-amber-500" : "border-transparent"}`} style={{ background: b.value }} />)}
          {ACCENTS.slice(0, 5).map((c) => <button key={c} data-testid={`bg-color-${c.slice(1)}`} aria-label={`Solid ${c}`} onClick={() => setBg({ type: "color", value: c })} className={`${sw} ${isOn({ type: "color", value: c }) ? "border-amber-500" : "border-transparent"}`} style={{ background: c }} />)}
          <input type="color" data-testid="bg-custom-color-input" aria-label="Custom background colour" value={photo.bg?.type === "color" ? photo.bg.value : "#1A2234"} onChange={(e) => setBg({ type: "color", value: e.target.value })} className="w-10 h-10 rounded-lg bg-transparent cursor-pointer" />
        </div>
      </div>
      {["library", "premium", "team"].map((tier) => {
        const items = library.filter((b) => b.tier === tier);
        if (!items.length) return null;
        return (
          <div key={tier} className="space-y-2" data-testid={`bg-tier-${tier}`}>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{tier === "team" ? "Team presets" : tier === "library" ? "Background library" : "Premium"} <span className="text-amber-500">· {NEED[tier]}+</span></p>
            <div className="flex flex-wrap gap-2">
              {items.map((b) => (
                <button key={b.id} data-testid={`bg-lib-${b.id}`} title={b.name} aria-label={b.name}
                  onClick={() => (b.locked ? upgradeToast(`${b.name} needs the ${NEED[tier]} plan or higher.`) : setBg({ type: b.type === "image" ? "image" : "gradient", value: b.value, tier }))}
                  className={`relative ${sw} overflow-hidden ${photo.bg?.value === b.value && b.value ? "border-amber-500" : "border-transparent"}`}
                  style={{ background: b.type === "gradient" ? b.preview : `center/cover url(${b.preview})` }}>
                  {b.locked && <span className="absolute inset-0 grid place-items-center bg-black/55"><Lock className="w-3 h-3 text-amber-400" /></span>}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <input ref={bgInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onBgFile} data-testid="bg-image-file-input" />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="rounded-full" data-testid="bg-upload-image-button"
          onClick={() => (f.custom_backgrounds ? bgInput.current.click() : upgradeToast("Custom background uploads are included in Pro and Team."))}>
          {f.custom_backgrounds ? <ImageIcon className="w-4 h-4 mr-1" /> : <Lock className="w-3 h-3 mr-1" />}Upload background image</Button>
        {photo.cutout && <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setPhoto({ ...photo, cutout: "", useCutout: false })} data-testid="bg-restore-original-button">Restore original</Button>}
      </div>
      <p className="text-xs text-muted-foreground">Only use background images you have rights to (no official logos or stadium photos you don't own).</p>
    </div>
  );
};

export const PhotoPanel = ({ photo, setPhoto, ent }) => {
  const input = useRef(null);
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try { setPhoto({ ...blankPhoto, bg: photo.bg, src: await processPhoto(file) }); toast.success("Photo added. Drag the card preview to reposition."); }
    catch (err) { toast.error(err.message); }
  };
  return (
    <div className="space-y-5">
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} data-testid="photo-file-input" />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => input.current.click()} className="rounded-full font-bold hover:bg-amber-400 hover:text-slate-950" data-testid="photo-upload-button">
          {photo.src ? <><RefreshCw className="w-4 h-4 mr-1" /> Replace photo</> : <><Upload className="w-4 h-4 mr-1" /> Upload photo</>}</Button>
        {photo.src && <Button variant="outline" className="rounded-full" onClick={() => setPhoto(blankPhoto)} data-testid="photo-remove-button"><Trash2 className="w-4 h-4 mr-1" /> Remove</Button>}
        {photo.src && <Button variant="ghost" className="rounded-full" onClick={() => setPhoto({ ...photo, zoom: 1, x: 0, y: 0, rotate: 0 })} data-testid="photo-reset-position-button">Reset position</Button>}
      </div>
      <p className="text-xs text-muted-foreground">JPG, PNG or WebP up to {MAX_MB} MB. Your photo is processed on this device only and is never uploaded. Only use photos you have permission to use.</p>
      {photo.src && <Adjust photo={photo} setPhoto={setPhoto} />}
      {photo.src && <Effects photo={photo} setPhoto={setPhoto} ent={ent} />}
      {photo.src && <BackgroundSection photo={photo} setPhoto={setPhoto} ent={ent} />}
    </div>
  );
};
