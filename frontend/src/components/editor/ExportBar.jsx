import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Link } from "react-router-dom";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { Download, Share2, Loader2, Save, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PlayerCard, StoryCard } from "@/components/card/PlayerCard";
import { useApi, errMsg } from "@/lib/api";

const slug = (s) => (s || "player").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "player";
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);

async function dataUrlToFile(url, name) {
  const blob = await (await fetch(url)).blob();
  return new File([blob], name, { type: "image/png" });
}

function download(url, name) {
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
}

export function ExportBar({ state, sport, template, onSave, saving, isSignedIn, onChooseTemplate, onNewCard }) {
  const api = useApi();
  const cardRef = useRef(null);
  const storyRef = useRef(null);
  const created = useRef(false);
  const [wm, setWm] = useState(true);
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState(null);
  const [premium, setPremium] = useState("");

  const render = async (format) => {
    const res = await api("post", "/cards/export", { sport_id: sport.id, template_id: template.id, format });
    flushSync(() => setWm(res.watermark));
    await document.fonts.ready;
    const node = format === "story" ? storyRef.current : cardRef.current;
    const opts = { pixelRatio: 3, cacheBust: false };
    await toPng(node, opts);
    if (isIOS()) await toPng(node, opts);
    const url = await toPng(node, opts);
    if (!created.current) {
      created.current = true;
      api("post", "/events", { type: "card_created", sport_id: sport.id, template_id: template.id }).catch(() => {});
    }
    return { url, format, name: `${slug(state.data.name)}-${format}-rivalcard.png` };
  };

  const run = async (format, mode) => {
    if (!sport || !template) return;
    setBusy(`${mode}-${format}`);
    try {
      const r = await render(format);
      setResult(r);
      if (mode === "share") await shareResult(r);
      else { download(r.url, r.name); toast.success(`${format === "story" ? "Story" : "Card"} PNG downloaded`); }
    } catch (e) {
      if (e?.response?.status === 402) setPremium(errMsg(e));
      else toast.error(errMsg(e, "Export failed. Try again, or use a different photo."));
    } finally { setBusy(""); }
  };

  const shareResult = async (r) => {
    const file = await dataUrlToFile(r.url, r.name);
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "My player card", text: "Made with RivalCard" }); return; }
      catch (e) { if (e.name === "AbortError") return; }
    }
    download(r.url, r.name);
    toast.message("Your browser can't share images directly, so we downloaded it. See the steps below to post it.");
  };

  const B = ({ format, mode, icon: Icon, label, primary }) => (
    <Button onClick={() => run(format, mode)} disabled={!!busy} variant={primary ? "default" : "outline"} data-testid={`export-${mode}-${format}-button`}
      className={`rounded-full font-bold ${primary ? "hover:bg-amber-400 hover:text-slate-950" : "hover:bg-accent hover:text-foreground"}`}>
      {busy === `${mode}-${format}` ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Icon className="w-4 h-4 mr-1" />}{label}
    </Button>
  );

  return (
    <>
      <div className="flex flex-wrap gap-2 justify-center" data-testid="export-bar">
        <B format="card" mode="download" icon={Download} label="Card PNG" primary />
        <B format="story" mode="download" icon={Download} label="Story PNG" />
        <B format="story" mode="share" icon={Share2} label="Share" />
        {isSignedIn ? (
          <Button variant="outline" onClick={onSave} disabled={saving} data-testid="save-card-button" className="rounded-full hover:bg-accent hover:text-foreground"><Save className="w-4 h-4 mr-1" />{saving ? "Saving…" : "Save"}</Button>
        ) : (
          <Button asChild variant="ghost" className="rounded-full" data-testid="sign-in-to-save-link"><Link to="/sign-in">Sign in to save</Link></Button>
        )}
      </div>

      <div aria-hidden style={{ position: "fixed", left: -10000, top: 0, pointerEvents: "none" }}>
        <PlayerCard ref={cardRef} template={template} sport={sport} data={state.data} photo={state.photo} watermark={wm} />
        <StoryCard ref={storyRef} template={template} sport={sport} data={state.data} photo={state.photo} watermark={wm} />
      </div>

      <Dialog open={!!result} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto" data-testid="export-result-dialog">
          <DialogHeader>
            <DialogTitle className="font-display uppercase text-2xl">Your card is ready</DialogTitle>
            <DialogDescription>If the download didn't start, long-press (or right-click) the image and choose “Save image”.</DialogDescription>
          </DialogHeader>
          {result && <img src={result.url} alt="Exported player card" data-testid="export-result-image" className={`mx-auto rounded-lg border border-border ${result.format === "story" ? "max-h-[46vh]" : "max-h-[40vh]"}`} />}
          <div className="grid grid-cols-2 gap-2">
            <Button data-testid="result-download-button" onClick={() => download(result.url, result.name)} className="rounded-full font-bold hover:bg-amber-400 hover:text-slate-950"><Download className="w-4 h-4 mr-1" />Download PNG</Button>
            <Button data-testid="result-share-button" variant="outline" onClick={() => shareResult(result)} className="rounded-full"><Share2 className="w-4 h-4 mr-1" />Share</Button>
            <Button data-testid="result-edit-button" variant="ghost" onClick={() => setResult(null)} className="rounded-full">Edit card</Button>
            <Button data-testid="result-another-template-button" variant="ghost" onClick={() => { setResult(null); onChooseTemplate(); }} className="rounded-full">Another template</Button>
            <Button data-testid="result-new-card-button" variant="ghost" onClick={() => { setResult(null); onNewCard(); }} className="rounded-full col-span-2">Create another card</Button>
          </div>
          <div className="text-xs text-muted-foreground space-y-1 border-t border-border pt-3" data-testid="manual-share-steps">
            <p className="font-semibold text-foreground">Post it manually</p>
            <p><b>WhatsApp Status:</b> open WhatsApp → Updates → tap the camera/pencil → pick the image from your gallery.</p>
            <p><b>Instagram Story:</b> open Instagram → swipe right or tap + → Story → choose the image.</p>
            <p>Use the <b>Story PNG</b> for a perfect 9:16 fit.</p>
            <button data-testid="copy-site-link-button" className="inline-flex items-center gap-1 text-amber-500 hover:underline mt-1" onClick={() => navigator.clipboard?.writeText(window.location.origin).then(() => toast.success("Link copied"))}>
              <Copy className="w-3 h-3" /> Copy RivalCard link to invite teammates</button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!premium} onOpenChange={(o) => !o && setPremium("")}>
        <DialogContent className="max-w-sm" data-testid="premium-required-dialog">
          <DialogHeader>
            <DialogTitle className="font-display uppercase text-2xl">Premium design</DialogTitle>
            <DialogDescription>{premium}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button asChild className="rounded-full font-bold" data-testid="premium-view-plans-button"><Link to="/pricing">View plans</Link></Button>
            <Button variant="outline" className="rounded-full" data-testid="premium-choose-free-button" onClick={() => { setPremium(""); onChooseTemplate(); }}>Choose a free template</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
