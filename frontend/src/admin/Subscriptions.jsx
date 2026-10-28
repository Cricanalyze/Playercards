import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi, errMsg, fmtDate, fmtDateTime, inr } from "@/lib/api";
import { useMeta, PageHead } from "./AdminApp";

const day = (s) => (s ? s.slice(0, 10) : "");
const PAY_LABEL = { created: "pending", authorized: "pending", captured: "paid", failed: "failed", refunded: "refunded" };

export function SubActions({ sub, onDone }) {
  const api = useApi();
  const [days, setDays] = useState("30");
  const [dates, setDates] = useState(null);
  const active = ["active", "trialing", "past_due"].includes(sub.status);
  const act = async (fn, ok) => { try { await fn(); toast.success(ok); setDates(null); onDone(); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <div className="flex flex-wrap items-center gap-1 ml-auto">
      <Input value={days} onChange={(e) => setDays(e.target.value)} className="w-16 h-8" type="number" min={1} data-testid={`sub-extend-days-${sub.id}`} />
      <Button size="sm" variant="outline" className="h-8" onClick={() => act(() => api("post", `/admin/subscriptions/${sub.id}/extend`, { days: Number(days) }), "Extended")} data-testid={`sub-extend-${sub.id}`}>Extend</Button>
      {!dates && <Button size="sm" variant="ghost" className="h-8" onClick={() => setDates({ start_at: day(sub.start_at), end_at: day(sub.end_at) })} data-testid={`sub-dates-${sub.id}`}>Dates</Button>}
      {dates && <>
        <Input type="date" className="h-8 w-36" value={dates.start_at} onChange={(e) => setDates({ ...dates, start_at: e.target.value })} data-testid={`sub-start-input-${sub.id}`} />
        <Input type="date" className="h-8 w-36" value={dates.end_at} onChange={(e) => setDates({ ...dates, end_at: e.target.value })} data-testid={`sub-end-input-${sub.id}`} />
        <Button size="sm" className="h-8" onClick={() => act(() => api("patch", `/admin/subscriptions/${sub.id}/dates`, dates), "Dates updated")} data-testid={`sub-dates-save-${sub.id}`}>Save</Button>
      </>}
      {active && <Button size="sm" variant="destructive" className="h-8" onClick={() => act(() => api("post", `/admin/subscriptions/${sub.id}/cancel`, { immediate: true }), "Access revoked")} data-testid={`sub-revoke-${sub.id}`}>Revoke</Button>}
    </div>
  );
}

const Report = () => {
  const api = useApi();
  const [r, setR] = useState(null);
  useEffect(() => { api("get", "/admin/subscription-report").then(setR).catch(() => {}); }, [api]);
  if (!r) return null;
  return (
    <div className="grid lg:grid-cols-3 gap-4 mb-8" data-testid="subscription-report">
      <div className="rounded-xl border border-border p-5">
        <p className="font-semibold mb-2">Users</p>
        <p className="text-sm">Total <b data-testid="report-users-total">{r.users.total}</b> · Paid <b className="text-amber-500" data-testid="report-users-paid">{r.users.paid}</b> · Free <b data-testid="report-users-free">{r.users.free}</b></p>
      </div>
      <div className="rounded-xl border border-border p-5">
        <p className="font-semibold mb-2">Active by plan & billing</p>
        {r.active.length === 0 ? <p className="text-sm text-muted-foreground">No active subscriptions.</p> : r.active.map((a) => (
          <p key={`${a.plan_id}-${a.cycle}-${a.source}`} className="text-sm flex justify-between"><span className="capitalize">{a.plan_id} · {a.cycle === "year" ? "yearly" : "monthly"} · {a.source}</span><b>{a.count}</b></p>))}
      </div>
      <div className="rounded-xl border border-border p-5">
        <p className="font-semibold mb-2">Monthly revenue report</p>
        {r.monthly.length === 0 ? <p className="text-sm text-muted-foreground">No captured payments yet.</p> : r.monthly.map((m) => (
          <p key={`${m.month}-${m.cycle}-${m.status}`} className="text-sm flex justify-between"><span>{m.month} · {m.cycle === "year" ? "yearly" : "monthly"} · {PAY_LABEL[m.status]}</span><b>{m.count} · {inr(m.amount_inr)}</b></p>))}
      </div>
    </div>
  );
};

export default function Subscriptions() {
  const api = useApi();
  const meta = useMeta();
  const [status, setStatus] = useState("all");
  const [subs, setSubs] = useState([]);
  const [payments, setPayments] = useState([]);
  const load = () => api("get", "/admin/subscriptions", null, { status: status === "all" ? "" : status }).then(setSubs).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); api("get", "/admin/payments").then(setPayments).catch(() => {}); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps
  const manage = meta.my_perms.includes("subscriptions.manage");
  return (
    <div data-testid="admin-subscriptions">
      <PageHead title="Subscriptions" sub="Assign plans or complimentary access from a user's Manage panel. Paid plans activate only after Razorpay verification.">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40" data-testid="subs-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All states</SelectItem>{meta.sub_states.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </PageHead>
      <Report />
      <div className="rounded-xl border border-border overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Plan</TableHead><TableHead>Status</TableHead><TableHead>Source</TableHead><TableHead>Period</TableHead>{manage && <TableHead>Actions</TableHead>}</TableRow></TableHeader>
          <TableBody>
            {subs.map((s) => (
              <TableRow key={s.id} data-testid={`sub-row-${s.id}`}>
                <TableCell className="text-sm">{s.user_email}</TableCell>
                <TableCell><b>{s.plan_snapshot.name}</b><span className="text-xs text-muted-foreground block">{s.cycle === "year" ? "yearly" : "monthly"}</span></TableCell>
                <TableCell><Badge variant="outline" className="uppercase">{s.status}</Badge></TableCell>
                <TableCell className="capitalize text-sm">{s.source}</TableCell>
                <TableCell className="text-sm">{fmtDate(s.start_at)} → {s.end_at ? fmtDate(s.end_at) : "∞"}
                  <details className="text-[11px] text-muted-foreground"><summary className="cursor-pointer">History</summary>{(s.history || []).map((h, i) => <p key={i}>{fmtDateTime(h.at)} · {h.event}</p>)}</details></TableCell>
                {manage && <TableCell><SubActions sub={s} onDone={load} /></TableCell>}
              </TableRow>
            ))}
            {subs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No subscriptions.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      <h2 className="font-display font-black uppercase text-2xl mt-10 mb-3">Payment records</h2>
      {payments.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-border p-6" data-testid="payments-empty">No payments recorded yet.</p>
      ) : (
        <div className="rounded-xl border border-border overflow-x-auto" data-testid="payments-table">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>User</TableHead><TableHead>Plan</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Razorpay IDs</TableHead></TableRow></TableHeader>
            <TableBody>{payments.map((p) => (
              <TableRow key={p.id} data-testid={`payment-row-${p.id}`}>
                <TableCell className="text-sm">{fmtDateTime(p.created_at)}</TableCell><TableCell className="text-sm">{p.user_email}</TableCell>
                <TableCell className="text-sm">{p.plan_name} · {p.cycle === "year" ? "yearly" : "monthly"}</TableCell><TableCell>{inr(p.amount_inr)}</TableCell>
                <TableCell><Badge variant={p.status === "captured" ? "secondary" : "outline"} className="uppercase">{PAY_LABEL[p.status] || p.status}</Badge></TableCell>
                <TableCell className="font-mono text-[10px]">{p.order_id}<br />{p.razorpay_payment_id || "—"}</TableCell>
              </TableRow>))}</TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
