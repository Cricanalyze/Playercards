import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi, errMsg, fmtDateTime } from "@/lib/api";
import { PageHead } from "./AdminApp";

export default function Audit() {
  const api = useApi();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const load = () => api("get", "/admin/audit", null, { q }).then(setRows).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div data-testid="admin-audit">
      <PageHead title="Audit log" sub="Every sensitive admin action is recorded. Passwords, tokens and payment credentials are never logged.">
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex gap-2">
          <Input placeholder="Action, actor or target" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" data-testid="audit-search-input" />
          <Button type="submit" data-testid="audit-search-button">Search</Button>
        </form>
      </PageHead>
      <div className="rounded-xl border border-border overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Actor</TableHead><TableHead>Action</TableHead><TableHead>Target</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} data-testid={`audit-row-${r.id}`}>
                <TableCell className="text-sm whitespace-nowrap">{fmtDateTime(r.at)}</TableCell>
                <TableCell className="text-sm">{r.actor_email}</TableCell>
                <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{r.action}</code></TableCell>
                <TableCell className="text-xs font-mono max-w-[160px] truncate">{r.target}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-sm truncate">{JSON.stringify(r.details)}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No entries.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
