import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { Undo2, Lock, Clock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppData } from "@/context/AppData";
import { useApi, errMsg, fmtDate } from "@/lib/api";
import { ScaledCard, useWidth } from "@/components/card/PlayerCard";
import { blankData, blankPhoto, defaultShow } from "@/lib/cardUtils";
import { SportPanel, TemplatePanel, PhotoPanel, DetailsPanel, StatsPanel, StylePanel, canUse } from "@/components/editor/Panels";
import { ExportBar } from "@/components/editor/ExportBar";
import { PageSkeleton } from "@/components/Skeletons";

const TABS = [["sport", "1 Sport"], ["design", "2 Design"], ["photo", "3 Photo"], ["details", "4 Details"], ["stats", "5 Stats"], ["style", "6 Style"]];

function useCardState() {
  const [state, setState] = useState({ sportId: "", templateId: "classic_athlete", data: blankData(null), photo: blankPhoto });
  const hist = useRef([]);
  const [canUndo, setCanUndo] = useState(false);
  const update = (patch, record = true) => setState((s) => {
    if (record) { hist.current = [...hist.current.slice(-49), s]; setCanUndo(true); }
    return { ...s, ...(typeof patch === "function" ? patch(s) : patch) };
  });
  const undo = () => { const p = hist.current.pop(); if (p) setState(p); setCanUndo(hist.current.length > 0); };
  return { state, update, undo, canUndo };
}

const EDIT_MS = 6 * 60 * 60 * 1000;

const EditLock = ({ reason, onNew }) => (
  <div className="mb-4 rounded-2xl border border-amber-500/50 bg-amber-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3" data-testid="editor-lock-banner">
    <div className="flex gap-3"><Lock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
      <p className="text-sm" data-testid="editor-lock-message">{reason === "free_plan"
        ? "Free plan cards can't be edited after they're created or downloaded. Start a new card, or upgrade to edit cards for 6 hours."
        : "The 6-hour edit window for this card has closed. Start a new card to make changes."}</p></div>
    <div className="flex gap-2 shrink-0">
      <button onClick={onNew} data-testid="editor-lock-new-card" className="px-4 h-9 rounded-full bg-amber-500 text-slate-950 text-sm font-bold">New card</button>
      {reason === "free_plan" && <Link to="/pricing" data-testid="editor-lock-upgrade" className="px-4 h-9 inline-flex items-center rounded-full border border-border text-sm font-semibold">Upgrade</Link>}
    </div>
  </div>
);

const Credits = ({ ent, isSignedIn }) => {
  if (!isSignedIn) return <p className="text-xs text-center text-muted-foreground" data-testid="editor-credits">Sign in to download — Free plan includes 2 cards a month.</p>;
  if (!ent) return null;
  const low = ent.cards_remaining === 0;
  return (
    <div className={`text-xs text-center rounded-full border px-3 py-1.5 ${low ? "border-destructive/50 text-destructive" : "border-border text-muted-foreground"}`} data-testid="editor-credits">
      <b className="text-foreground">{ent.plan_name}</b> · {ent.cards_remaining} of {ent.cards_per_month} card credits left · resets {fmtDate(ent.reset_at)}
      {low && <Link to="/pricing" className="ml-2 text-amber-500 font-semibold hover:underline" data-testid="editor-upgrade-link">Upgrade</Link>}
    </div>
  );
};

function Preview({ state, sport, template, format, setFormat, onDrag, locked }) {
  const [ref, w] = useWidth(format === "story" ? 300 : 340);
  const drag = useRef(null);
  const down = (e) => { if (!state.photo.src) return; drag.current = { x: e.clientX, y: e.clientY, px: state.photo.x, py: state.photo.y }; e.currentTarget.setPointerCapture(e.pointerId); onDrag(null); };
  const move = (e) => {
    if (!drag.current) return;
    const k = 100 / w / state.photo.zoom;
    const clamp = (v) => Math.max(-60, Math.min(60, v));
    onDrag({ x: clamp(drag.current.px + (e.clientX - drag.current.x) * k), y: clamp(drag.current.py + (e.clientY - drag.current.y) * k) });
  };
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="inline-flex rounded-full border border-border p-1 text-xs font-bold uppercase" role="tablist">
        {["card", "story"].map((f) => (
          <button key={f} data-testid={`preview-format-${f}`} onClick={() => setFormat(f)} className={`px-4 h-8 rounded-full transition-colors ${format === f ? "bg-amber-500 text-slate-950" : "text-muted-foreground hover:text-foreground"}`}>{f === "card" ? "Card 5:7" : "Story 9:16"}</button>
        ))}
      </div>
      <div ref={ref} className="w-full flex justify-center">
        <div data-testid="live-card-preview" onPointerDown={down} onPointerMove={move} onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)}
          className={`relative touch-none drop-shadow-[0_20px_40px_rgba(0,0,0,.45)] ${state.photo.src ? "cursor-grab active:cursor-grabbing" : ""}`}>
          <ScaledCard width={w} format={format} template={template} sport={sport} data={state.data} photo={state.photo} watermark={false} />
          {locked && <span className="absolute -top-3 right-3 inline-flex items-center gap-1 bg-amber-500 text-slate-950 text-[10px] font-bold uppercase px-2 py-1 rounded-full" data-testid="preview-premium-badge"><Lock className="w-3 h-3" />{template.collection}</span>}
        </div>
      </div>
    </div>
  );
}

export default function Create() {
  const { sports, templates, me, isSignedIn } = useAppData();
  const api = useApi();
  const [params, setParams] = useSearchParams();
  const { state, update, undo, canUndo } = useCardState();
  const [tab, setTab] = useState("sport");
  const [format, setFormat] = useState("card");
  const [savedId, setSavedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(null);
  const [exported, setExported] = useState(false);
  const startedAt = useRef(Date.now());
  const inited = useRef(false);

  const sport = useMemo(() => sports.find((s) => s.id === state.sportId), [sports, state.sportId]);
  const template = useMemo(() => templates.find((t) => t.id === state.templateId) || templates[0], [templates, state.templateId]);
  const ent = me?.entitlements;

  const pickSport = (s, record = true) => update((st) => ({
    sportId: s.id,
    data: { ...st.data, statKeys: s.stats.slice(0, 6).map((x) => x.key), show: { ...defaultShow(s.kind), social: st.data.show.social },
      stats: Object.fromEntries(Object.entries(st.data.stats).filter(([k]) => s.stats.some((x) => x.key === k))) },
    templateId: record && s.kind === "esports" && st.templateId === "classic_athlete" ? "esports_pro" : st.templateId,
  }), record);

  useEffect(() => {
    if (inited.current || !sports.length || !templates.length) return;
    inited.current = true;
    const s = sports.find((x) => x.id === params.get("sport"));
    const t = params.get("template");
    const cardId = params.get("card");
    pickSport(s || sports[0], false);
    if (t && templates.some((x) => x.id === t)) update({ templateId: t }, false);
    setTab(s ? "design" : t ? "photo" : "sport");
    if (cardId && isSignedIn) {
      api("get", "/me/cards").then((cards) => {
        const c = cards.find((x) => x.id === cardId);
        if (c) { setLoaded(c); startedAt.current = new Date(c.created_at).getTime(); update({ sportId: c.sport_id, templateId: c.template_id, data: { ...blankData(sports.find((x) => x.id === c.sport_id)), ...c.data } }, false); setSavedId(c.id); setTab("photo"); toast.message("Saved card loaded. Add your photo again — photos are never stored."); }
      }).catch(() => {});
    }
  }, [sports, templates]); // eslint-disable-line react-hooks/exhaustive-deps

  const setData = (patch) => update((s) => ({ data: { ...s.data, ...patch } }));
  const setPhoto = (photo, record = true) => update({ photo }, record);

  const save = async (quiet = false) => {
    setSaving(true);
    try {
      const body = { title: state.data.name || sport?.name, sport_id: sport.id, template_id: template.id, data: state.data };
      let id = savedId;
      if (savedId) await api("put", `/me/cards/${savedId}`, body);
      else { const c = await api("post", "/me/cards", body); id = c.id; setSavedId(c.id); setLoaded(c); setParams({ card: c.id }, { replace: true }); }
      if (!quiet) toast.success("Card saved to your account (photo not stored).");
      return id;
    } catch (e) { toast.error(errMsg(e)); return null; } finally { setSaving(false); }
  };
  const ensureSaved = () => (savedId ? Promise.resolve(savedId) : save(true));

  const newCard = () => { update({ data: blankData(sport), photo: blankPhoto }); setSavedId(null); setLoaded(null); setExported(false); startedAt.current = Date.now(); setParams({}, { replace: true }); setTab("photo"); };

  if (!sport || !template) return <div data-testid="editor-loading"><PageSkeleton variant="editor" /></div>;
  const locked = !canUse(template, ent);
  const paid = !!ent && ent.plan_id !== "free";
  const editUntil = startedAt.current + EDIT_MS;
  const lock = loaded && !loaded.editable ? loaded.lock_reason
    : exported && !paid ? "free_plan"
    : (exported || loaded) && paid && Date.now() > editUntil ? "window_closed" : "";

  return (
    <div className="container-x py-6 lg:py-10" data-testid="card-editor-page">
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <p className="eyebrow">Card creator · {sport.name}</p>
          <h1 className="font-display font-black uppercase text-3xl sm:text-4xl">Build your card</h1>
        </div>
        <button onClick={undo} disabled={!canUndo || !!lock} data-testid="editor-undo-button" className="inline-flex items-center gap-1 text-sm font-semibold px-3 h-9 rounded-full border border-border disabled:opacity-40 hover:bg-accent transition-colors"><Undo2 className="w-4 h-4" />Undo</button>
      </div>
      <div className="grid lg:grid-cols-[420px_1fr] gap-8 items-start">
        <div className="lg:sticky lg:top-24 rounded-3xl border border-border bg-card/50 stage-grid p-5 space-y-5">
          <Preview state={state} sport={sport} template={template} format={format} setFormat={setFormat} locked={locked} onDrag={(p) => lock ? null : p ? update((s) => ({ photo: { ...s.photo, ...p } }), false) : update((s) => ({ photo: s.photo }))} />
          <ExportBar state={state} sport={sport} template={template} isSignedIn={isSignedIn} onSave={() => save()} saving={saving} canSave={!(lock && savedId)} isPaid={paid} ensureSaved={ensureSaved} onExported={() => setExported(true)} storybook={["pro", "team"].includes(ent?.plan_id)} onChooseTemplate={() => setTab("design")} onNewCard={newCard} />
          <Credits ent={ent} isSignedIn={isSignedIn} />
          {paid && (exported || loaded) && !lock && <p className="text-[11px] text-center text-amber-500 inline-flex items-center justify-center gap-1 w-full" data-testid="edit-window-note"><Clock className="w-3 h-3" />You can edit this card until {new Date(editUntil).toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}</p>}
          <p className="text-[11px] text-center text-muted-foreground">Each PNG download or share uses 1 card credit. Free exports include a small watermark. Paid plans can edit a card for 6 hours after creating it. Stats are self-reported.</p>
        </div>
        <div className="min-w-0">
        {lock && <EditLock reason={lock} onNew={newCard} />}
        <fieldset disabled={!!lock} className={lock ? "opacity-50 pointer-events-none select-none" : ""} data-testid="editor-fieldset">
        <Tabs value={tab} onValueChange={setTab} className="min-w-0">
          <TabsList className="w-full justify-start overflow-x-auto h-auto p-1 rounded-full [scrollbar-width:none]">
            {TABS.map(([v, l]) => <TabsTrigger key={v} value={v} data-testid={`editor-tab-${v}`} className="rounded-full font-bold uppercase text-xs tracking-wide px-4 h-9 shrink-0">{l}</TabsTrigger>)}
          </TabsList>
          <div className="mt-6 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <TabsContent value="sport" className="mt-0"><SportPanel sports={sports} sport={sport} onPick={(s) => { pickSport(s); setTab("design"); }} /></TabsContent>
            <TabsContent value="design" className="mt-0"><TemplatePanel templates={templates} state={state} sport={sport} ent={ent} onPick={(id) => update({ templateId: id })} /></TabsContent>
            <TabsContent value="photo" className="mt-0"><PhotoPanel photo={state.photo} setPhoto={setPhoto} ent={ent} /></TabsContent>
            <TabsContent value="details" className="mt-0"><DetailsPanel sport={sport} d={state.data} setData={setData} /></TabsContent>
            <TabsContent value="stats" className="mt-0"><StatsPanel sport={sport} d={state.data} setData={setData} /></TabsContent>
            <TabsContent value="style" className="mt-0"><StylePanel d={state.data} template={template} setData={setData} ent={ent} onReset={() => update({ data: blankData(sport), photo: blankPhoto })} /></TabsContent>
          </div>
        </Tabs>
        </fieldset>
        </div>
      </div>
    </div>
  );
}
