import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Show } from "@clerk/react";
import { toast } from "sonner";
import { Trash2, Pencil, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAppData } from "@/context/AppData";
import { useApi, errMsg, fmtDate, inr } from "@/lib/api";

function Inner() {
  const { me, meError, sports, templates, refreshMe } = useAppData();
  const api = useApi();
  const [cards, setCards] = useState(null);
  const load = () => api("get", "/me/cards").then(setCards).catch(() => setCards([]));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (meError) return <div className="container-x py-24 text-center" data-testid="dashboard-error">{meError}</div>;
  if (!me) return <div className="container-x py-24 text-center text-muted-foreground">Loading your account…</div>;
  const { member, entitlements: ent, subscriptions, payments } = me;
  const del = async (id) => { try { await api("delete", `/me/cards/${id}`); toast.success("Card deleted"); load(); } catch (e) { toast.error(errMsg(e)); } };
  const deleteMe = async () => { try { await api("delete", "/me"); toast.success("Your data was deleted."); refreshMe(); } catch (e) { toast.error(errMsg(e)); } };

  return (
    <div className="container-x py-10 space-y-10" data-testid="dashboard-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">My account</p>
          <h1 className="font-display font-black uppercase text-4xl sm:text-5xl">Hey, {member.name}</h1>
          <p className="text-sm text-muted-foreground" data-testid="dashboard-email">{member.email}</p>
        </div>
        <Button asChild className="rounded-full font-bold hover:bg-amber-400 hover:text-slate-950" data-testid="dashboard-new-card-button"><Link to="/create">New card</Link></Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-6 md:col-span-1" data-testid="dashboard-plan-card">
          <p className="eyebrow">Current access</p>
          <p className="font-display font-black uppercase text-3xl mt-2 flex items-center gap-2">{ent.sources.length ? <><Crown className="w-6 h-6 text-amber-500" />{ent.sources.map((s) => s.plan).join(" + ")}</> : "Free"}</p>
          <ul className="text-sm text-muted-foreground mt-3 space-y-1">
            <li>Premium templates: <b className="text-foreground">{ent.all_premium_templates ? "All" : ent.premium_templates.length ? ent.premium_templates.join(", ") : "None"}</b></li>
            <li>Watermark: <b className="text-foreground">{ent.remove_watermark ? "Removed" : "On"}</b></li>
            <li>Saved cards limit: <b className="text-foreground">{ent.saved_cards}</b></li>
            {ent.team_cards > 0 && <li>Team cards: <b className="text-foreground">{ent.team_cards}</b></li>}
          </ul>
        </div>
        <div className="rounded-2xl border border-border p-6 md:col-span-2">
          <p className="eyebrow">Subscription history</p>
          {subscriptions.length === 0 ? <p className="text-sm text-muted-foreground mt-3">No plans yet. <Link to="/pricing" className="text-amber-500 hover:underline">See plans</Link></p> : (
            <div className="mt-3 divide-y divide-border">
              {subscriptions.map((s) => (
                <div key={s.id} className="py-2 flex flex-wrap items-center justify-between gap-2 text-sm" data-testid={`my-subscription-${s.id}`}>
                  <span className="font-semibold">{s.plan_snapshot.name}</span>
                  <Badge variant="outline" className="uppercase">{s.status}</Badge>
                  <span className="text-muted-foreground">{s.source === "payment" ? "Paid" : s.source}</span>
                  <span className="text-muted-foreground">{fmtDate(s.start_at)} → {s.end_at ? fmtDate(s.end_at) : "No expiry"}</span>
                </div>
              ))}
            </div>
          )}
          <p className="eyebrow mt-6">Billing history</p>
          {payments.length === 0 ? <p className="text-sm text-muted-foreground mt-2">No payments. Online payments are not enabled yet.</p>
            : payments.map((p) => <p key={p.id} className="text-sm">{fmtDate(p.created_at)} · {inr(p.amount_inr)} · {p.status}</p>)}
        </div>
      </div>

      <div>
        <h2 className="font-display font-black uppercase text-2xl">Saved cards</h2>
        <p className="text-sm text-muted-foreground">Only card details are saved — re-add your photo when you open one.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4" data-testid="saved-cards-list">
          {cards === null ? <p className="text-muted-foreground text-sm">Loading…</p> : cards.length === 0 ? <p className="text-sm text-muted-foreground" data-testid="saved-cards-empty">No saved cards yet.</p> :
            cards.map((c) => (
              <div key={c.id} className="rounded-xl border border-border p-4 flex items-center justify-between gap-3" data-testid={`saved-card-${c.id}`}>
                <div className="min-w-0">
                  <p className="font-display font-bold uppercase text-lg truncate">{c.title || c.data?.name || "Untitled"}</p>
                  <p className="text-xs text-muted-foreground truncate">{sports.find((s) => s.id === c.sport_id)?.name} · {templates.find((t) => t.id === c.template_id)?.name} · {fmtDate(c.updated_at)}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button asChild size="icon" variant="ghost" data-testid={`saved-card-open-${c.id}`}><Link to={`/create?card=${c.id}`} aria-label="Open"><Pencil className="w-4 h-4" /></Link></Button>
                  <Button size="icon" variant="ghost" onClick={() => del(c.id)} data-testid={`saved-card-delete-${c.id}`} aria-label="Delete"><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
        </div>
      </div>

      <div className="rounded-2xl border border-destructive/40 p-6">
        <p className="font-semibold">Delete my data</p>
        <p className="text-sm text-muted-foreground mt-1">Removes your saved cards and closes your RivalCard profile. To remove your login too, use “Manage account” in the profile menu.</p>
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="destructive" className="mt-4 rounded-full" data-testid="delete-my-data-button">Delete my data</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Delete all your data?</AlertDialogTitle><AlertDialogDescription>This cannot be undone. Your saved cards will be erased and your account closed.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={deleteMe} data-testid="confirm-delete-my-data-button">Delete</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (<><Show when="signed-in"><Inner /></Show><Show when="signed-out"><Navigate to="/sign-in" replace /></Show></>);
}
