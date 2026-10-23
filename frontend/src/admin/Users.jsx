import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi, errMsg, fmtDate, fmtDateTime } from "@/lib/api";
import { useMeta, PageHead } from "./AdminApp";
import UserDialog from "./UserDialog";

export const RoleBadge = ({ role }) => (
  <Badge variant="outline" className={`uppercase text-[10px] ${role === "super_admin" ? "border-amber-500 text-amber-500" : role !== "user" ? "border-cyan-500 text-cyan-500" : ""}`}>{role.replace("_", " ")}</Badge>
);

export default function Users() {
  const api = useApi();
  const meta = useMeta();
  const [f, setF] = useState({ q: "", role: "all", status: "all", sort: "-created_at", page: 1 });
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [openId, setOpenId] = useState(null);
  const load = (p = f) => api("get", "/admin/users", null, { q: p.q, role: p.role === "all" ? "" : p.role, status: p.status === "all" ? "" : p.status, sort: p.sort, page: p.page }).then(setData).catch((e) => setErr(errMsg(e)));
  useEffect(() => { load(); }, [f.role, f.status, f.sort, f.page]); // eslint-disable-line react-hooks/exhaustive-deps
  const S = ({ k, items, w = "w-40", id }) => (
    <Select value={f[k]} onValueChange={(v) => setF({ ...f, [k]: v, page: 1 })}>
      <SelectTrigger className={w} data-testid={id}><SelectValue /></SelectTrigger>
      <SelectContent>{items.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
    </Select>
  );
  return (
    <div data-testid="admin-users">
      <PageHead title="Users" sub={data ? `${data.total} accounts` : ""}>
        <form onSubmit={(e) => { e.preventDefault(); const p = { ...f, page: 1 }; setF(p); load(p); }} className="flex gap-2">
          <Input placeholder="Name, email or user ID" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} className="w-56" data-testid="users-search-input" />
          <Button type="submit" data-testid="users-search-button">Search</Button>
        </form>
        <S k="role" id="users-role-filter" items={[["all", "All roles"], ["staff", "All staff"], ...meta.roles.map((r) => [r, r.replace("_", " ")])]} />
        <S k="status" id="users-status-filter" w="w-36" items={[["all", "Any status"], ["active", "Active"], ["suspended", "Suspended"], ["deleted", "Deleted"]]} />
        <S k="sort" id="users-sort-select" items={[["-created_at", "Newest"], ["created_at", "Oldest"], ["-last_seen_at", "Recently active"], ["email", "Email A–Z"]]} />
      </PageHead>
      {err && <p className="text-destructive">{err}</p>}
      <div className="rounded-xl border border-border overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Joined</TableHead><TableHead>Last active</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {data?.users.map((u) => (
              <TableRow key={u.user_id} data-testid={`user-row-${u.user_id}`}>
                <TableCell><p className="font-semibold">{u.name}</p><p className="text-xs text-muted-foreground">{u.email}</p></TableCell>
                <TableCell><RoleBadge role={u.role} /></TableCell>
                <TableCell><Badge variant={u.status === "active" ? "secondary" : "destructive"} className="uppercase text-[10px]">{u.status}</Badge></TableCell>
                <TableCell className="text-sm">{fmtDate(u.created_at)}</TableCell>
                <TableCell className="text-sm">{fmtDateTime(u.last_seen_at)}</TableCell>
                <TableCell><Button size="sm" variant="outline" onClick={() => setOpenId(u.user_id)} data-testid={`user-manage-${u.user_id}`}>Manage</Button></TableCell>
              </TableRow>
            ))}
            {data?.users.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No users match.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      {data && data.pages > 1 && (
        <div className="flex items-center gap-2 justify-end mt-4">
          <Button size="sm" variant="outline" disabled={f.page <= 1} onClick={() => setF({ ...f, page: f.page - 1 })} data-testid="users-prev-page">Prev</Button>
          <span className="text-sm">Page {data.page} / {data.pages}</span>
          <Button size="sm" variant="outline" disabled={f.page >= data.pages} onClick={() => setF({ ...f, page: f.page + 1 })} data-testid="users-next-page">Next</Button>
        </div>
      )}
      {openId && <UserDialog userId={openId} onClose={() => { setOpenId(null); load(); }} />}
    </div>
  );
}
