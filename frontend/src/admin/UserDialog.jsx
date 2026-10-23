import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApi, errMsg, fmtDate, fmtDateTime } from "@/lib/api";
import { useAppData } from "@/context/AppData";
import { useMeta } from "./AdminApp";
import { RoleBadge } from "./Users";
import { SubActions } from "./Subscriptions";

const Box = ({ title, children }) => <div className="rounded-xl border border-border p-4 space-y-3"><p className="font-semibold text-sm">{title}</p>{children}</div>;

export function PermPicker({ role, value, onChange, meta }) {
  const allowed = role === "super_admin" ? Object.keys(meta.permissions) : role === "user" ? [] : [...new Set([...meta.role_defaults[role], ...(role === "admin" ? ["admins.manage"] : [])])];
  if (role === "super_admin") return <p className="text-xs text-muted-foreground">Super Admin always has every permission.</p>;
  if (!allowed.length) return null;
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      {allowed.map((p) => (
        <label key={p} className="flex items-center gap-2 text-xs"><Checkbox data-testid={`perm-${p}`} checked={value.includes(p)} disabled={!meta.my_perms.includes(p) && meta.my_role !== "super_admin"}
          onCheckedChange={(v) => onChange(v ? [...value, p] : value.filter((x) => x !== p))} />{meta.permissions[p]}</label>
      ))}
    </div>
  );
}

function Grant({ userId, onDone }) {
  const api = useApi();
  const { plans, templates } = useAppData();
  const [g, setG] = useState({ plan_id: "pro_creator", days: "30", template_id: "", source: "complimentary", note: "" });
  const plan = plans.find((p) => p.id === g.plan_id);
  const submit = async () => {
    try { await api("post", "/admin/subscriptions", { ...g, user_id: userId, days: g.days ? Number(g.days) : null, template_id: g.template_id || null }); toast.success("Access granted"); onDone(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      <Select value={g.plan_id} onValueChange={(v) => setG({ ...g, plan_id: v, days: String(plans.find((p) => p.id === v)?.default_days || "") })}>
        <SelectTrigger data-testid="grant-plan-select"><SelectValue /></SelectTrigger>
        <SelectContent>{plans.filter((p) => p.type !== "free").map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={g.source} onValueChange={(v) => setG({ ...g, source: v })}>
        <SelectTrigger data-testid="grant-source-select"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="complimentary">Complimentary</SelectItem><SelectItem value="promotion">Promotion</SelectItem></SelectContent>
      </Select>
      {plan?.entitlements?.premium_template_choices > 0 && (
        <Select value={g.template_id} onValueChange={(v) => setG({ ...g, template_id: v })}>
          <SelectTrigger data-testid="grant-template-select"><SelectValue placeholder="Premium template" /></SelectTrigger>
          <SelectContent>{plan.eligible_templates.map((t) => <SelectItem key={t} value={t}>{templates.find((x) => x.id === t)?.name || t}</SelectItem>)}</SelectContent>
        </Select>
      )}
      <Input type="number" min={1} placeholder="Days (blank = no expiry)" value={g.days} onChange={(e) => setG({ ...g, days: e.target.value })} data-testid="grant-days-input" />
      <Input placeholder="Internal note" value={g.note} onChange={(e) => setG({ ...g, note: e.target.value })} data-testid="grant-note-input" />
      <Button onClick={submit} data-testid="grant-submit-button">Grant access</Button>
    </div>
  );
}

export default function UserDialog({ userId, onClose }) {
  const api = useApi();
  const meta = useMeta();
  const [d, setD] = useState(null);
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState({ role: "user", permissions: [], confirm_email: "" });
  const load = () => api("get", `/admin/users/${userId}`).then((r) => { setD(r); setRole({ role: r.user.role, permissions: r.user.perms, confirm_email: "" }); }).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps
  const can = (p) => meta.my_perms.includes(p);
  const act = async (fn, ok) => { try { await fn(); toast.success(ok); load(); } catch (e) { toast.error(errMsg(e)); } };
  const u = d?.user;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="user-detail-dialog">
        <DialogHeader>
          <DialogTitle className="font-display uppercase text-2xl">{u?.name || "User"}</DialogTitle>
          <DialogDescription>{u?.email} · <span className="font-mono text-[11px]">{userId}</span></DialogDescription>
        </DialogHeader>
        {d && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center text-sm">
              <RoleBadge role={u.role} /><Badge variant={u.status === "active" ? "secondary" : "destructive"} className="uppercase" data-testid="user-status-badge">{u.status}</Badge>
              <span className="text-muted-foreground">Joined {fmtDate(u.created_at)} · Last active {fmtDateTime(u.last_seen_at)} · {d.saved_cards} saved cards</span>
            </div>
            <Box title="Entitlements">
              <p className="text-sm" data-testid="user-entitlements">Premium: <b>{d.entitlements.all_premium_templates ? "All templates" : d.entitlements.premium_templates.join(", ") || "None"}</b> · Watermark: <b>{d.entitlements.remove_watermark ? "Off" : "On"}</b> · Saved limit: <b>{d.entitlements.saved_cards}</b></p>
            </Box>
            <Box title="Subscriptions">
              {d.subscriptions.length === 0 && <p className="text-sm text-muted-foreground">None</p>}
              {d.subscriptions.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center gap-2 text-sm border-b border-border pb-2" data-testid={`user-sub-${s.id}`}>
                  <b>{s.plan_snapshot.name}</b><Badge variant="outline" className="uppercase">{s.status}</Badge><span className="text-muted-foreground">via {s.source}</span>
                  <span className="text-muted-foreground">until {s.end_at ? fmtDate(s.end_at) : "no expiry"}{s.cancel_at_period_end ? " (won't renew)" : ""}</span>
                  {can("subscriptions.manage") && <SubActions sub={s} onDone={load} />}
                </div>
              ))}
              {can("subscriptions.manage") && u.status !== "deleted" && <><p className="text-xs text-muted-foreground pt-1">Grant complimentary / promotional access</p><Grant userId={userId} onDone={load} /></>}
            </Box>
            <Box title="Payments">{d.payments.length === 0 ? <p className="text-sm text-muted-foreground">No payments (gateway not configured).</p> : d.payments.map((p) => <p key={p.id} className="text-sm">{p.id} · {p.status}</p>)}</Box>
            {can("users.manage") && u.status !== "deleted" && (
              <Box title="Account security">
                <div className="flex flex-wrap gap-2">
                  {u.status === "active"
                    ? <Button variant="destructive" size="sm" data-testid="user-suspend-button" onClick={() => act(() => api("patch", `/admin/users/${userId}`, { status: "suspended", reason: "admin action" }), "User suspended & sessions revoked")}>Suspend</Button>
                    : <Button size="sm" data-testid="user-reactivate-button" onClick={() => act(() => api("patch", `/admin/users/${userId}`, { status: "active" }), "User reactivated")}>Reactivate</Button>}
                  <Button variant="outline" size="sm" data-testid="user-revoke-sessions-button" onClick={() => act(() => api("post", `/admin/users/${userId}/revoke-sessions`), "Sessions revoked")}>Revoke sessions</Button>
                </div>
                <p className="text-xs text-muted-foreground">Passwords are never visible to admins. Users reset their own password with “Forgot password?” on the sign-in page (a secure code is emailed to them).</p>
                <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-border">
                  <Input placeholder={`Type ${u.email} to soft-delete`} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="max-w-xs" data-testid="user-delete-confirm-input" />
                  <Button variant="destructive" size="sm" data-testid="user-soft-delete-button" onClick={() => act(() => api("post", `/admin/users/${userId}/soft-delete`, { confirm_email: confirm }), "Account soft-deleted")}>Soft-delete</Button>
                </div>
                <p className="text-xs text-muted-foreground">Soft-delete erases saved cards and blocks the account. Permanent login removal: Emergent dashboard → Manage → Users & Auth.</p>
              </Box>
            )}
            {can("admins.manage") && u.status !== "deleted" && (
              <Box title="Role & permissions">
                <Select value={role.role} onValueChange={(v) => setRole({ ...role, role: v, permissions: meta.role_defaults[v] })}>
                  <SelectTrigger className="w-56" data-testid="user-role-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{meta.roles.map((r) => <SelectItem key={r} value={r} disabled={!meta.assignable_roles.includes(r)}>{r.replace("_", " ")}</SelectItem>)}</SelectContent>
                </Select>
                <PermPicker role={role.role} value={role.permissions} onChange={(p) => setRole({ ...role, permissions: p })} meta={meta} />
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="space-y-1"><Label className="text-xs">Re-enter your own email to confirm</Label>
                    <Input value={role.confirm_email} onChange={(e) => setRole({ ...role, confirm_email: e.target.value })} className="w-64" data-testid="role-confirm-email-input" /></div>
                  <Button className="self-end" data-testid="role-save-button" onClick={() => act(() => api("patch", `/admin/users/${userId}/role`, { role: role.role, permissions: role.role === "super_admin" || role.role === "user" ? null : role.permissions, confirm_email: role.confirm_email }), "Role updated")}>Save role</Button>
                </div>
              </Box>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
