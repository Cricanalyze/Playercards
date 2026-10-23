import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApi, errMsg, fmtDateTime } from "@/lib/api";
import { PageHead } from "./AdminApp";

export default function Reports() {
  const api = useApi();
  const [rows, setRows] = useState([]);
  const load = () => api("get", "/admin/reports").then(setRows).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const setStatus = async (id, status) => { try { await api("patch", `/admin/reports/${id}`, { status }); toast.success("Updated"); load(); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <div data-testid="admin-reports">
      <PageHead title="Reports & support" sub="Content reports and support messages from the contact form." />
      <div className="space-y-3">
        {rows.length === 0 && <p className="text-muted-foreground">No reports.</p>}
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-border p-4 flex flex-wrap gap-4 justify-between" data-testid={`report-row-${r.id}`}>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">{fmtDateTime(r.created_at)} · {r.target} · {r.contact || "no contact"}</p>
              <p className="mt-1 whitespace-pre-wrap break-words">{r.reason}</p>
            </div>
            <Select value={r.status} onValueChange={(v) => setStatus(r.id, v)}>
              <SelectTrigger className="w-36" data-testid={`report-status-${r.id}`}><SelectValue /></SelectTrigger>
              <SelectContent>{["open", "reviewing", "resolved", "dismissed"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}
