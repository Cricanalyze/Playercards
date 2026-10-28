import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi, errMsg, fmtDateTime } from "@/lib/api";
import { useMeta, PageHead } from "./AdminApp";
import { PermPicker } from "./UserDialog";
import { RoleBadge } from "./Users";

export default function Team() {
  const api = useApi();
  const meta = useMeta();
  const roles = meta.staff_roles.filter((r) => meta.assignable_roles.includes(r));
  const [f, setF] = useState({ email: "", role: roles.includes("support") ? "support" : roles[0], permissions: meta.role_defaults.support || [], expires_hours: 72 });
  const [link, setLink] = useState("");
  const [invites, setInvites] = useState([]);
  const [staff, setStaff] = useState([]);
  const load = () => {
    api("get", "/admin/invitations").then(setInvites).catch((e) => toast.error(errMsg(e)));
    api("get", "/admin/users", null, { role: "staff" }).then((r) => setStaff(r.users)).catch(() => {});
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const send = async (e) => {
    e.preventDefault();
    try {
      const r = await api("post", "/admin/invitations", { ...f, expires_hours: Number(f.expires_hours), permissions: f.role === "super_admin" ? null : f.permissions });
      setLink(`${window.location.origin}/invite/${r.token}`); toast.success("Invitation created"); load();
    } catch (err) { toast.error(errMsg(err)); }
  };
  const revoke = async (id) => { try { await api("delete", `/admin/invitations/${id}`); toast.success("Invitation revoked"); load(); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <div data-testid="admin-team">
      <PageHead title="Admins & invitations" sub="Invite trusted people by email. Each person creates their own account — never share passwords." />
      <div className="grid xl:grid-cols-[1fr_1.2fr] gap-6">
        <form onSubmit={send} className="rounded-xl border border-border p-5 space-y-3" data-testid="invite-form">
          <p className="font-semibold">New invitation</p>
          <div className="space-y-1"><Label>Email</Label><Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} data-testid="invite-email-input" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Role</Label>
              <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v, permissions: meta.role_defaults[v] })}><SelectTrigger data-testid="invite-role-select"><SelectValue /></SelectTrigger>
                <SelectContent>{roles.map((r) => <SelectItem key={r} value={r}>{r.replace("_", " ")}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>Expires in (hours)</Label><Input type="number" min={1} max={720} value={f.expires_hours} onChange={(e) => setF({ ...f, expires_hours: e.target.value })} data-testid="invite-expiry-input" /></div>
          </div>
          <PermPicker role={f.role} value={f.permissions} onChange={(p) => setF({ ...f, permissions: p })} meta={meta} />
          <Button type="submit" data-testid="invite-submit-button">Create invitation</Button>
          {link && (
            <div className="rounded-lg bg-muted p-3 space-y-2" data-testid="invite-link-box">
              <p className="text-xs">Single-use link — send it privately to the invitee. It's shown only once.</p>
              <div className="flex gap-2"><Input readOnly value={link} className="font-mono text-xs" data-testid="invite-link-input" />
                <Button type="button" size="icon" variant="outline" onClick={() => navigator.clipboard?.writeText(link).then(() => toast.success("Copied"))} data-testid="invite-copy-button"><Copy className="w-4 h-4" /></Button></div>
            </div>
          )}
        </form>
        <div className="rounded-xl border border-border p-5">
          <p className="font-semibold mb-3">Current staff</p>
          {staff.map((s) => <div key={s.user_id} className="flex items-center justify-between py-2 border-b border-border text-sm" data-testid={`staff-row-${s.user_id}`}><span>{s.name} <span className="text-muted-foreground">{s.email}</span></span><RoleBadge role={s.role} /></div>)}
          <p className="text-xs text-muted-foreground mt-3">Change roles or disable access from Users → Manage.</p>
        </div>
      </div>
      <h2 className="font-display font-black uppercase text-2xl mt-10 mb-3">Invitation history</h2>
      <div className="rounded-xl border border-border overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Invited by</TableHead><TableHead>Expires</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {invites.map((i) => (
              <TableRow key={i.id} data-testid={`invite-row-${i.id}`}>
                <TableCell>{i.email}</TableCell><TableCell><RoleBadge role={i.role} /></TableCell>
                <TableCell><Badge variant="outline" className="uppercase">{i.status}</Badge></TableCell>
                <TableCell className="text-sm">{i.created_by_email}</TableCell><TableCell className="text-sm">{fmtDateTime(i.expires_at)}</TableCell>
                <TableCell>{i.status === "pending" && <Button size="sm" variant="outline" onClick={() => revoke(i.id)} data-testid={`invite-revoke-${i.id}`}>Revoke</Button>}</TableCell>
              </TableRow>
            ))}
            {invites.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No invitations yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
