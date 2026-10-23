import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useApi, errMsg, inr } from "@/lib/api";
import { useAppData } from "@/context/AppData";
import { PageHead } from "./AdminApp";

const Stat = ({ label, value, id, tone = "" }) => (
  <div className="rounded-xl border border-border bg-card p-4" data-testid={`metric-${id}`}>
    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className={`font-display font-black text-3xl mt-1 ${tone}`}>{value}</p>
  </div>
);

const Top = ({ title, rows, names }) => (
  <div className="rounded-xl border border-border bg-card p-5">
    <p className="font-semibold mb-3">{title}</p>
    {rows.length === 0 ? <p className="text-sm text-muted-foreground">No data yet.</p> : rows.map((r) => {
      const max = rows[0].count;
      return (
        <div key={r.id} className="mb-2">
          <div className="flex justify-between text-sm"><span>{names[r.id] || r.id}</span><span className="font-mono">{r.count}</span></div>
          <div className="h-1.5 bg-muted rounded-full mt-1"><div className="h-1.5 bg-amber-500 rounded-full" style={{ width: `${(r.count / max) * 100}%` }} /></div>
        </div>
      );
    })}
  </div>
);

export default function Overview() {
  const api = useApi();
  const { sports, templates } = useAppData();
  const [m, setM] = useState(null);
  const [range, setRange] = useState({ frm: "", to: "" });
  const [err, setErr] = useState("");
  const load = () => api("get", "/admin/metrics", null, { frm: range.frm || undefined, to: range.to || undefined }).then(setM).catch((e) => setErr(errMsg(e)));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const names = Object.fromEntries([...sports, ...templates].map((x) => [x.id, x.name]));
  return (
    <div data-testid="admin-overview">
      <PageHead title="Overview" sub="Live numbers from the database. Nothing here is estimated.">
        <Input type="date" value={range.frm} onChange={(e) => setRange({ ...range, frm: e.target.value })} className="w-40" data-testid="metrics-from-input" />
        <Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className="w-40" data-testid="metrics-to-input" />
        <Button onClick={load} data-testid="metrics-apply-button">Apply</Button>
      </PageHead>
      {err && <p className="text-destructive">{err}</p>}
      {m && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <Stat id="users-total" label="Total users" value={m.users.total} />
            <Stat id="users-new" label="New users" value={m.users.new} />
            <Stat id="users-active" label="Active (30d)" value={m.users.active_30d} />
            <Stat id="users-free" label="Free users" value={m.users.free} />
            <Stat id="users-premium" label="Premium users" value={m.users.premium} tone="text-amber-500" />
            <Stat id="users-suspended" label="Suspended" value={m.users.suspended} />
            <Stat id="subs-active" label="Active subscriptions" value={m.subscriptions.active} />
            <Stat id="subs-expired" label="Expired" value={m.subscriptions.expired} />
            <Stat id="subs-canceled" label="Cancellations" value={m.subscriptions.canceled} />
            <Stat id="cards-created" label="Cards created" value={m.cards.created} />
            <Stat id="cards-downloaded" label="Cards downloaded" value={m.cards.downloaded} />
            <Stat id="subs-comp" label="Complimentary active" value={m.subscriptions.by_source.complimentary + m.subscriptions.by_source.promotion} />
          </div>
          <div className="rounded-xl border border-border p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4"><p className="font-semibold">Payments</p>
              <span className="text-[11px] uppercase tracking-wider px-2 py-1 rounded bg-muted text-muted-foreground" data-testid="payments-gateway-status">Gateway: not configured</span></div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              <Stat id="pay-success" label="Successful" value={m.payments.successful} />
              <Stat id="pay-failed" label="Failed" value={m.payments.failed} />
              <Stat id="pay-gross" label="Gross collected" value={inr(m.payments.gross_inr)} />
              <Stat id="pay-refunds" label="Refunds" value={inr(m.payments.refunds_inr)} />
              <Stat id="pay-net" label="Net proceeds" value={inr(m.payments.net_inr)} />
              <Stat id="pay-mrr" label="Recurring (MRR)" value={inr(m.payments.mrr_inr)} />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Top title="Popular sports (cards created)" rows={m.popular_sports} names={names} />
            <Top title="Popular templates (downloads)" rows={m.popular_templates} names={names} />
          </div>
          <div className="text-xs text-muted-foreground space-y-1">{Object.entries(m.definitions).map(([k, v]) => <p key={k}><b className="uppercase">{k}</b>: {v}</p>)}</div>
        </div>
      )}
    </div>
  );
}
