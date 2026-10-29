import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { BookOpen, FileDown, Trash2, Lock, Loader2, Plus, Film, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/context/AppData";
import { useApi, errMsg, fmtDate } from "@/lib/api";
import { useStoryImages } from "@/components/storybook/useStoryImages";
import { FlipBook } from "@/components/storybook/FlipBook";
import { StoryViewer } from "@/components/storybook/StoryViewer";
import { buildStorybookPdf } from "@/components/storybook/pdf";
import { buildStoryVideo, videoSupported } from "@/components/storybook/video";

const TABS = [["flip", "Flip-book", BookOpen], ["story", "Story video", Film], ["pdf", "PDF booklet", FileDown]];

const Upsell = () => (
  <div className="rounded-3xl border border-amber-500/40 bg-amber-500/5 p-8 sm:p-12 text-center max-w-2xl mx-auto" data-testid="storybook-upsell">
    <Lock className="w-8 h-8 text-amber-500 mx-auto" />
    <h2 className="font-display font-black uppercase text-3xl sm:text-4xl mt-4">Storybook is a Pro feature</h2>
    <p className="text-muted-foreground mt-3 text-sm sm:text-base">On Pro and Team plans every card you download is saved to your storybook. Flip through it like an album, play it as a story slideshow, or download it as a printable PDF.</p>
    <Button asChild className="rounded-full font-bold mt-6" data-testid="storybook-upgrade-button"><Link to="/pricing">See Pro plan</Link></Button>
  </div>
);

export default function Storybook() {
  const api = useApi();
  const { me } = useAppData();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("flip");
  const [story, setStory] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [vid, setVid] = useState(null);
  const load = () => api("get", "/me/storybook").then(setData).catch((e) => { toast.error(errMsg(e)); setData({ enabled: false, pages: [] }); });
  useEffect(() => { load(); document.title = "My Storybook · FlexoCards"; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const pages = data?.pages || [];
  const { urls, blobs } = useStoryImages(pages);
  const name = me?.member?.name || "";
  if (!data) return <div className="container-x py-24 text-center text-muted-foreground">Loading storybook…</div>;
  const del = async (p) => {
    if (!window.confirm("Remove this card from your storybook?")) return;
    try { await api("delete", `/me/storybook/${p.id}`); setData({ ...data, pages: pages.filter((x) => x.id !== p.id) }); toast.success("Removed"); } catch (e) { toast.error(errMsg(e)); }
  };
  const pdf = async () => {
    setPdfBusy(true);
    try { const n = await buildStorybookPdf(pages, blobs, name); toast.success(`PDF ready with ${n} cards`); } catch { toast.error("Couldn't build the PDF. Try again."); } finally { setPdfBusy(false); }
  };
  const ready = pages.filter((p) => urls[p.id]).length;
  const video = async () => {
    setVid(0);
    try {
      const r = await buildStoryVideo(pages, urls, setVid);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(r.blob);
      a.download = `flexocards-story-${new Date().toISOString().slice(0, 10)}.${r.ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast.success(`Story video ready (${r.seconds} sec, ${r.ext.toUpperCase()})`);
    } catch { toast.error("Couldn't make the video in this browser. Try Chrome or Safari."); } finally { setVid(null); }
  };
  return (
    <div className="container-x py-10 sm:py-14" data-testid="storybook-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">Pro · Team</p><h1 className="font-display font-black uppercase text-4xl sm:text-5xl lg:text-6xl tracking-tight">My storybook</h1>
          <p className="text-sm text-muted-foreground mt-2">Every card you download is added automatically. {pages.length > 0 && `${pages.length} card${pages.length === 1 ? "" : "s"} so far.`}</p></div>
        <Button asChild className="rounded-full font-bold" data-testid="storybook-new-card"><Link to="/create"><Plus className="w-4 h-4 mr-1" />New card</Link></Button>
      </div>
      {!data.enabled && pages.length === 0 ? <div className="mt-10"><Upsell /></div> : (
        <>
          {!data.enabled && <p className="mt-6 rounded-xl border border-amber-500/40 p-3 text-sm" data-testid="storybook-readonly-note">Your plan no longer includes the storybook, so new cards won't be added. <Link to="/pricing" className="text-amber-500 underline">Upgrade to Pro</Link> to keep adding.</p>}
          <div className="mt-8 inline-flex p-1 rounded-full border border-border bg-muted/40 max-w-full overflow-x-auto" data-testid="storybook-tabs">
            {TABS.map(([id, label, Icon]) => (
              <button key={id} onClick={() => setTab(id)} data-testid={`storybook-tab-${id}`}
                className={`shrink-0 px-4 h-10 rounded-full text-sm font-semibold inline-flex items-center gap-2 transition-colors ${tab === id ? "bg-amber-500 text-slate-950" : "text-muted-foreground hover:text-foreground"}`}><Icon className="w-4 h-4" />{label}</button>
            ))}
          </div>
          {pages.length === 0 ? (
            <div className="mt-10 rounded-3xl border border-dashed border-border p-12 text-center" data-testid="storybook-empty">
              <BookOpen className="w-8 h-8 mx-auto text-amber-500" /><p className="mt-3 font-semibold">Your storybook is empty</p>
              <p className="text-sm text-muted-foreground">Download a card and it will show up here.</p>
            </div>
          ) : (
            <div className="mt-8">
              {tab === "flip" && <FlipBook pages={pages} urls={urls} name={name} />}
              {tab === "story" && (
                <div className="rounded-3xl border border-border p-8 text-center bg-[#0b1a3a] text-white" data-testid="storybook-story-panel">
                  <Film className="w-8 h-8 mx-auto text-amber-400" />
                  <p className="font-display font-black uppercase text-3xl mt-3">Story video</p>
                  <p className="text-sm text-slate-300 mt-2">A 9:16 video (1080×1920) with 5 seconds for each card, ready for Instagram Stories, Reels or WhatsApp Status.</p>
                  <p className="text-xs text-slate-400 mt-1">{ready} cards · {ready * 5} seconds</p>
                  <div className="flex flex-wrap justify-center gap-2 mt-6">
                    <Button onClick={video} disabled={vid !== null || ready === 0 || !videoSupported()} className="rounded-full font-bold" data-testid="storybook-video-button">
                      {vid !== null ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Film className="w-4 h-4 mr-1" />}
                      {vid !== null ? `Making video… ${Math.round(vid * 100)}%` : "Download video"}</Button>
                    <Button variant="outline" onClick={() => setStory(0)} disabled={vid !== null} className="rounded-full font-bold bg-transparent text-white border-white/30 hover:bg-white/10 hover:text-white" data-testid="storybook-play-button"><Play className="w-4 h-4 mr-1" />Preview</Button>
                  </div>
                  {vid !== null && (
                    <div className="max-w-sm mx-auto mt-5" data-testid="storybook-video-progress">
                      <div className="h-2 rounded-full bg-white/15 overflow-hidden"><div className="h-full bg-amber-400 transition-[width]" style={{ width: `${vid * 100}%` }} /></div>
                      <p className="text-[11px] text-slate-400 mt-2">Keep this tab open while the video records. It takes as long as the video itself.</p>
                    </div>
                  )}
                  {!videoSupported() && <p className="text-xs text-amber-400 mt-3">This browser can't record video. Try Chrome or Safari.</p>}
                </div>
              )}
              {tab === "pdf" && (
                <div className="rounded-3xl border border-border p-8 text-center" data-testid="storybook-pdf-panel">
                  <FileDown className="w-8 h-8 mx-auto text-amber-500" />
                  <p className="font-display font-black uppercase text-3xl mt-3">Printable PDF booklet</p>
                  <p className="text-sm text-muted-foreground mt-2">A4 pages with a cover and one card per page, ready to print or send.</p>
                  <Button onClick={pdf} disabled={pdfBusy || ready === 0} className="rounded-full font-bold mt-6" data-testid="storybook-pdf-button">
                    {pdfBusy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileDown className="w-4 h-4 mr-1" />}Download PDF ({ready} cards)</Button>
                </div>
              )}
              <h2 className="font-display font-black uppercase text-2xl mt-14 mb-4">All pages</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4" data-testid="storybook-grid">
                {pages.map((p, k) => (
                  <div key={p.id} className="group rounded-xl border border-border overflow-hidden bg-card" data-testid={`storybook-page-${p.id}`}>
                    <button onClick={() => setStory(k)} className="block w-full aspect-[5/7] bg-muted protect" aria-label={`Play from ${p.title}`} data-testid={`storybook-page-open-${p.id}`}>
                      {urls[p.id] ? <img src={urls[p.id]} alt={p.title} draggable={false} className="w-full h-full object-contain group-hover:scale-[1.03] transition-transform" /> : <div className="w-full h-full animate-pulse" />}
                    </button>
                    <div className="p-2 flex items-center justify-between gap-1">
                      <div className="min-w-0"><p className="text-xs font-semibold truncate">{p.title}</p><p className="text-[10px] text-muted-foreground">{fmtDate(p.created_at)}</p></div>
                      <button onClick={() => del(p)} aria-label="Remove" data-testid={`storybook-page-delete-${p.id}`} className="w-7 h-7 grid place-items-center rounded-md hover:bg-accent shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      {story !== null && pages.length > 0 && <StoryViewer pages={pages} urls={urls} blobs={blobs} start={story} onClose={() => setStory(null)} />}
    </div>
  );
}
