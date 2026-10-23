import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi, errMsg, fmtDate } from "@/lib/api";
import { useMeta, PageHead } from "./AdminApp";

export function SubActions({ sub, onDone }) {
  const api = useApi();
  const [days, setDays] = useState("30");
  const active = ["active", "trialing", "past_due"].includes(sub.status);
  const act = async (path, body, ok) => { try { await api("post", `/admin/subscriptions/${sub.id}/${path}`, body); toast.success(ok); onDone(); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <div className="flex flex-wrap items-center gap-1 ml-auto">
      <Input value={days} onChange={(e) => setDays(e.target.value)} className="w-16 h-8" type="number" min={1} data-testid={`sub-extend-days-${sub.id}`} />
      <Button size="sm" variant="outline" className="h-8" onClick={() => act("extend", { days: Number(days) }, "Extended")} data-testid={`sub-extend-${sub.id}`}>Extend</Button>
      {active && !sub.cancel_at_period_end && <Button size="sm" variant="outline" className="h-8" onClick={() => act("cancel", { immediate: false }, "Renewal canceled; access continues to period end")} data-testid={`sub-cancel-renewal-${sub.id}`}>Cancel renewal</Button>}
      {active && <Button size="sm" variant="destructive" className="h-8" onClick={() => act("cancel", { immediate: true }, "Access revoked")} data-testid={`sub-revoke-${sub.id}`}>Revoke</Button>}
    </div>
  );
}

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
      <PageHead title="Subscriptions" sub="Grant new access from a user's Manage panel. Source shows whether access came from payment, promotion or a complimentary grant.">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40" data-testid="subs-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All states</SelectItem>{meta.sub_states.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </PageHead>
      <div className="rounded-xl border border-border overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Plan</TableHead><TableHead>Status</TableHead><TableHead>Source</TableHead><TableHead>Period</TableHead>{manage && <TableHead>Actions</TableHead>}</TableRow></TableHeader>
          <TableBody>
            {subs.map((s) => (
              <TableRow key={s.id} data-testid={`sub-row-${s.id}`}>
                <TableCell className="text-sm">{s.user_email}</TableCell>
                <TableCell><b>{s.plan_snapshot.name}</b>{s.template_id && <span className="text-xs text-muted-foreground block">{s.template_id}</span>}</TableCell>
                <TableCell><Badge variant="outline" className="uppercase">{s.status}</Badge>{s.cancel_at_period_end && <span className="text-[10px] block text-muted-foreground">no renewal</span>}</TableCell>
                <TableCell className="capitalize text-sm">{s.source}</TableCell>
                <TableCell className="text-sm">{fmtDate(s.start_at)} → {s.end_at ? fmtDate(s.end_at) : "∞"}</TableCell>
                {manage && <TableCell><SubActions sub={s} onDone={load} /></TableCell>}
              </TableRow>
            ))}
            {subs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No subscriptions.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      <h2 className="font-display font-black uppercase text-2xl mt-10 mb-3">Payment records</h2>
      {payments.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-border p-6" data-testid="payments-empty">No payments recorded. The payment gateway (e.g. Razorpay) is not configured yet, so no paid access can be granted automatically.</p>
      ) : payments.map((p) => <p key={p.id}>{p.id}</p>)}
    </div>
  );
}
