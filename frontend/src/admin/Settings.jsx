import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CreditCard, Mail, Loader2, Send, RotateCcw, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApi, errMsg, fmtDateTime } from "@/lib/api";
import { PageHead } from "./AdminApp";
import { ClerkEmails, TemplatesPreview, SocialSettings } from "./SettingsExtra";
import { SiteModeSettings } from "./SiteMode";
import { DatabaseSettings } from "./DatabaseSettings";

const F = ({ label, hint, children }) => (
  <div className="space-y-1.5 min-w-0"><Label>{label}</Label>{children}{hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}</div>
);

const Section = ({ icon: Icon, title, sub, children, testId }) => (
  <section className="rounded-xl border border-border p-5 space-y-4" data-testid={testId}>
    <div className="flex gap-3"><Icon className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" /><div><p className="font-semibold">{title}</p><p className="text-xs text-muted-foreground">{sub}</p></div></div>
    {children}
  </section>
);

function RazorpaySettings({ data, onSaved, onReset }) {
  const api = useApi();
  const [f, setF] = useState({ key_id: data.key_id, key_secret: "", webhook_secret: "" });
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try { onSaved(await api("put", "/admin/settings/razorpay", f)); setF({ ...f, key_secret: "", webhook_secret: "" }); toast.success("Razorpay keys checked and saved"); }
    catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <Section icon={CreditCard} title="Razorpay payments" testId="settings-razorpay"
      sub={`Mode: ${data.mode.replace("_", " ")} · Using keys from ${data.source === "admin" ? "this admin panel" : "server setup"}`}>
      <form onSubmit={save} className="grid sm:grid-cols-2 gap-4">
        <F label="Key ID" hint="Starts with rzp_test_ or rzp_live_"><Input required value={f.key_id} onChange={(e) => setF({ ...f, key_id: e.target.value })} className="font-mono" data-testid="rzp-key-id-input" /></F>
        <F label="Key Secret" hint={data.key_secret_hint ? `Saved: ${data.key_secret_hint} — leave blank to keep` : "Not set"}><Input type="password" autoComplete="new-password" value={f.key_secret} onChange={(e) => setF({ ...f, key_secret: e.target.value })} data-testid="rzp-key-secret-input" /></F>
        <F label="Webhook Secret (optional)" hint={data.webhook_secret_hint ? `Saved: ${data.webhook_secret_hint} — leave blank to keep` : "Lets refunds and late payments update on their own"}><Input type="password" autoComplete="new-password" value={f.webhook_secret} onChange={(e) => setF({ ...f, webhook_secret: e.target.value })} data-testid="rzp-webhook-secret-input" /></F>
        <F label="Webhook URL" hint="Paste this in Razorpay → Settings → Webhooks"><Input readOnly value={data.webhook_url} className="font-mono text-xs" data-testid="rzp-webhook-url" /></F>
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          <Button type="submit" disabled={busy} data-testid="rzp-save-button">{busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Check & save keys</Button>
          {data.source === "admin" && <Button type="button" variant="outline" onClick={onReset} data-testid="rzp-reset-button"><RotateCcw className="w-4 h-4 mr-1" />Use server keys</Button>}
        </div>
      </form>
    </Section>
  );
}

function EmailSettings({ data, onSaved, onReset }) {
  const api = useApi();
  const [f, setF] = useState({ ...data, smtp_pass: "" });
  const [busy, setBusy] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? e.target.value : e });
  const save = async (e) => {
    e.preventDefault(); setBusy("save");
    const { smtp_pass_hint, customized, ...body } = f; // eslint-disable-line no-unused-vars
    try { const r = await api("put", "/admin/settings/email", { ...body, smtp_port: Number(body.smtp_port) }); onSaved(r); setF({ ...r, smtp_pass: "" }); toast.success("Email settings saved"); }
    catch (err) { toast.error(errMsg(err)); } finally { setBusy(""); }
  };
  const test = async () => {
    setBusy("test");
    try { const r = await api("post", "/admin/settings/email/test"); toast.success(`Test email sent to ${r.to}`); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(""); onSaved(null); }
  };
  const smtp = f.provider === "smtp";
  return (
    <Section icon={Mail} title="Email sending" testId="settings-email" sub="Used for payment receipts, admin invitations and blog notifications.">
      <form onSubmit={save} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          {[["emergent", "Emergent email (default)", "Works right away, no setup"], ["smtp", "My SMTP server", "Sends from your own mailbox"]].map(([v, l, d]) => (
            <button type="button" key={v} onClick={() => setF({ ...f, provider: v })} data-testid={`email-provider-${v}`}
              className={`text-left rounded-xl border p-4 transition-colors ${f.provider === v ? "border-amber-500 bg-amber-500/10" : "border-border hover:border-amber-500/50"}`}>
              <p className="font-semibold text-sm">{l}</p><p className="text-xs text-muted-foreground">{d}</p>
            </button>
          ))}
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <F label="Sender name"><Input required value={f.from_name} onChange={set("from_name")} data-testid="email-from-name-input" /></F>
          <F label="Reply-to email (optional)"><Input type="email" value={f.reply_to} onChange={set("reply_to")} data-testid="email-reply-to-input" /></F>
          <F label="Website address" hint="Used for links in emails"><Input value={f.site_url} onChange={set("site_url")} placeholder="https://flexocards.com" data-testid="email-site-url-input" /></F>
        </div>
        {smtp && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 rounded-xl bg-muted/40 p-4" data-testid="smtp-fields">
            <F label="SMTP host"><Input value={f.smtp_host} onChange={set("smtp_host")} data-testid="smtp-host-input" /></F>
            <F label="Port"><Input type="number" value={f.smtp_port} onChange={set("smtp_port")} data-testid="smtp-port-input" /></F>
            <F label="Security">
              <Select value={f.smtp_secure} onValueChange={set("smtp_secure")}><SelectTrigger data-testid="smtp-secure-select"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ssl">SSL (port 465)</SelectItem><SelectItem value="starttls">STARTTLS (port 587)</SelectItem><SelectItem value="none">None</SelectItem></SelectContent></Select>
            </F>
            <F label="Username"><Input value={f.smtp_user} onChange={set("smtp_user")} data-testid="smtp-user-input" /></F>
            <F label="Password" hint={data.smtp_pass_hint ? `Saved: ${data.smtp_pass_hint} — leave blank to keep` : "Not set"}><Input type="password" autoComplete="new-password" value={f.smtp_pass} onChange={set("smtp_pass")} data-testid="smtp-pass-input" /></F>
            <F label="From email"><Input type="email" value={f.smtp_from_email} onChange={set("smtp_from_email")} data-testid="smtp-from-email-input" /></F>
            <F label="From name"><Input value={f.smtp_from_name} onChange={set("smtp_from_name")} data-testid="smtp-from-name-input" /></F>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!!busy} data-testid="email-save-button">{busy === "save" && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Save email settings</Button>
          <Button type="button" variant="outline" disabled={!!busy} onClick={test} data-testid="email-test-button">{busy === "test" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}Send me a test email</Button>
          {data.customized && <Button type="button" variant="ghost" onClick={onReset} data-testid="email-reset-button"><RotateCcw className="w-4 h-4 mr-1" />Reset to defaults</Button>}
        </div>
        <p className="text-[11px] text-muted-foreground">Save first, then send a test. The test goes to your own admin email.</p>
      </form>
    </Section>
  );
}

const EmailLog = ({ rows }) => (
  <Section icon={Send} title="Recent emails" sub="Last 15 emails the site tried to send." testId="settings-email-log">
    <div className="divide-y divide-border text-sm">
      {rows.length === 0 ? <p className="text-muted-foreground text-sm">No emails sent yet.</p> : rows.map((l) => (
        <div key={l.id} className="py-2 flex flex-wrap items-center gap-x-3 gap-y-1" data-testid={`email-log-${l.id}`}>
          {l.status === "sent" ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-destructive" />}
          <span className="font-medium truncate max-w-[220px]">{l.subject}</span>
          <span className="text-muted-foreground truncate">{l.to}</span>
          <span className="text-xs text-muted-foreground">{l.provider === "smtp" ? "SMTP" : "Emergent"} · {fmtDateTime(l.created_at)}</span>
          {l.error && <span className="w-full text-xs text-destructive">{l.error}</span>}
        </div>
      ))}
    </div>
  </Section>
);

export default function Settings() {
  const api = useApi();
  const [d, setD] = useState(null);
  const [v, setV] = useState(0);
  const load = () => api("get", "/admin/settings").then(setD).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const reset = async (section) => {
    if (!window.confirm("Go back to the default settings for this section?")) return;
    try { await api("delete", `/admin/settings/${section}`); toast.success("Reset to defaults"); await load(); setV(v + 1); } catch (e) { toast.error(errMsg(e)); }
  };
  if (!d) return <p className="text-muted-foreground">Loading settings…</p>;
  return (
    <div className="space-y-6" data-testid="admin-settings">
      <PageHead title="Settings" sub="Site status, payments, email, sign-in emails and social links. Only Super Admins can see this page." />
      <SiteModeSettings key={`m${v}`} data={d.site} status={d.site_status} onSaved={(r) => setD({ ...d, site: r.site, site_status: r.status })} />
      <DatabaseSettings data={d.database} onChange={(db) => setD({ ...d, database: db })} />
      <RazorpaySettings key={`r${v}`} data={d.razorpay} onSaved={(r) => setD({ ...d, razorpay: r })} onReset={() => reset("razorpay")} />
      <EmailSettings key={`e${v}`} data={d.email} onSaved={(r) => (r ? setD({ ...d, email: r }) : load())} onReset={() => reset("email")} />
      <ClerkEmails key={`c${v}`} data={d.clerk} onSaved={(r) => setD({ ...d, clerk: r })} onReset={() => reset("clerk")} />
      <TemplatesPreview templates={d.templates} />
      <SocialSettings key={`s${v}`} data={d.social} onSaved={(r) => setD({ ...d, social: r })} />
      <EmailLog rows={d.email_log} />
    </div>
  );
}
