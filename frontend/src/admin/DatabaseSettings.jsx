import { useState } from "react";
import { toast } from "sonner";
import { Database, Loader2, Download, PlugZap, RotateCcw, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useApi, errMsg } from "@/lib/api";

const Stats = ({ s }) => (
  <div className="grid grid-cols-3 gap-2 text-center">
    {[["Ping", `${s.ping_ms} ms`], ["Data", `${s.data_mb} MB`], ["Collections", Object.keys(s.collections || {}).length]].map(([l, v]) => (
      <div key={l} className="rounded-lg bg-muted/50 p-2"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{l}</p><p className="font-semibold text-sm">{v}</p></div>
    ))}
  </div>
);

export function DatabaseSettings({ data, onChange }) {
  const api = useApi();
  const [f, setF] = useState({ url: "", db_name: data.custom_db_name || "flexocards", copy_data: true });
  const [busy, setBusy] = useState("");
  const [test, setTest] = useState(null);
  const run = async (k, fn) => { setBusy(k); try { await fn(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(""); } };
  const doTest = () => run("test", async () => { const r = await api("post", "/admin/settings/database/test", f); setTest(r); toast.success(`Connected in ${r.ping_ms} ms`); });
  const doSwitch = () => {
    if (!window.confirm(`Switch the whole site to the "${f.db_name}" database?${f.copy_data ? " Your current data will be copied there first." : " Data will NOT be copied, so the site will start empty."}`)) return;
    run("switch", async () => {
      const r = await api("put", "/admin/settings/database", f);
      onChange(r.database); setF({ ...f, url: "" }); setTest(null);
      const n = Object.values(r.copied).reduce((a, b) => a + b, 0);
      toast.success(f.copy_data ? `Switched. Copied ${n} records.` : "Switched to your MongoDB");
    });
  };
  const doDefault = () => {
    if (!window.confirm("Switch back to the default Emergent database? Data added to your MongoDB since switching won't be copied back.")) return;
    run("default", async () => { onChange(await api("post", "/admin/settings/database/use-default")); toast.success("Back on the default database"); });
  };
  const backup = () => run("backup", async () => {
    const blob = await api("get", "/admin/settings/database/backup", null, null, { responseType: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `flexocards-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  const custom = data.mode === "custom";
  return (
    <section className="rounded-xl border border-border p-5 space-y-4" data-testid="settings-database">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3"><Database className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          <div><p className="font-semibold">Database (MongoDB)</p><p className="text-xs text-muted-foreground">The site uses the default Emergent database unless you connect your own MongoDB here.</p></div></div>
        <span className={`px-3 h-7 inline-flex items-center gap-1 rounded-full border text-xs font-bold ${data.ok ? "border-emerald-500 text-emerald-500" : "border-destructive text-destructive"}`} data-testid="db-status-badge">
          {data.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}{custom ? "Your MongoDB" : "Default database"} · {data.ok ? "connected" : "error"}
        </span>
      </div>
      {data.error && <p className="text-xs text-destructive" data-testid="db-error">{data.error}</p>}
      <div className="grid md:grid-cols-[1fr_auto] gap-4 items-end">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Active database: <b className="text-foreground" data-testid="db-active-name">{data.db_name}</b>{custom && <span className="font-mono"> · {data.custom_url}</span>}</p>
          {data.ok && <Stats s={data} />}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={backup} disabled={!!busy} data-testid="db-backup-button">{busy === "backup" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}Download backup</Button>
          {custom && <Button variant="outline" onClick={doDefault} disabled={!!busy} data-testid="db-use-default-button">{busy === "default" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-1" />}Use default database</Button>}
        </div>
      </div>
      <div className="rounded-xl bg-muted/40 p-4 space-y-4">
        <p className="text-sm font-semibold">Connect your own MongoDB</p>
        <div className="grid sm:grid-cols-[1fr_200px] gap-4">
          <div className="space-y-1.5 min-w-0"><Label>MongoDB URL</Label>
            <Input type="password" autoComplete="off" value={f.url} onChange={(e) => { setF({ ...f, url: e.target.value }); setTest(null); }} placeholder={data.custom_saved ? "Saved — leave blank to reuse" : "mongodb+srv://user:pass@cluster.mongodb.net"} className="font-mono" data-testid="db-url-input" /></div>
          <div className="space-y-1.5"><Label>Database name</Label><Input value={f.db_name} onChange={(e) => { setF({ ...f, db_name: e.target.value }); setTest(null); }} data-testid="db-name-input" /></div>
        </div>
        <div className="flex items-center gap-3"><Switch checked={f.copy_data} onCheckedChange={(v) => setF({ ...f, copy_data: v })} data-testid="db-copy-switch" /><Label className="font-normal text-sm">Copy all current data (users, cards, payments, blog) to the new database</Label></div>
        {test && <div data-testid="db-test-result"><p className="text-xs text-emerald-500 mb-2">Connection works. {Object.keys(test.collections).length ? `It already has ${Object.keys(test.collections).length} collections.` : "It's empty."}</p></div>}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={doTest} disabled={!!busy || (!f.url && !data.custom_saved)} data-testid="db-test-button">{busy === "test" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <PlugZap className="w-4 h-4 mr-1" />}Test connection</Button>
          <Button onClick={doSwitch} disabled={!!busy || !test} data-testid="db-switch-button">{busy === "switch" && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Switch site to this database</Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Test the connection first. Payment, email and site settings always stay safe in the default database, so you can switch back any time.</p>
      </div>
    </section>
  );
}
