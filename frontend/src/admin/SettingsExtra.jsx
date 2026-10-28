import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FileText, KeyRound, Share2, Loader2, Send, RotateCcw, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApi, errMsg } from "@/lib/api";
import { SOCIALS } from "@/components/layout/Social";

export const Section = ({ icon: Icon, title, sub, children, testId }) => (
  <section className="rounded-xl border border-border p-5 space-y-4 min-w-0" data-testid={testId}>
    <div className="flex gap-3"><Icon className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" /><div className="min-w-0"><p className="font-semibold">{title}</p><p className="text-xs text-muted-foreground">{sub}</p></div></div>
    {children}
  </section>
);

export function TemplatesPreview({ templates }) {
  const api = useApi();
  const [sel, setSel] = useState(templates[0]?.id);
  const [pv, setPv] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (sel) { setPv(null); api("get", `/admin/settings/email/preview/${sel}`).then(setPv).catch((e) => toast.error(errMsg(e))); } }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps
  const send = async () => {
    setBusy(true);
    try { const r = await api("post", `/admin/settings/email/preview/${sel}/send`); toast.success(`Sample sent to ${r.to}`); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Section icon={FileText} title="Email templates" sub="Every email FlexoCards sends, in your brand design. Pick one to preview it." testId="settings-email-templates">
      <div className="grid lg:grid-cols-[240px_1fr] gap-4">
        <div className="flex lg:flex-col gap-1 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {templates.map((t) => (
            <button key={t.id} onClick={() => setSel(t.id)} data-testid={`email-template-${t.id}`}
              className={`shrink-0 text-left px-3 py-2 rounded-lg text-sm transition-colors ${sel === t.id ? "bg-amber-500 text-slate-950 font-semibold" : "hover:bg-accent text-muted-foreground"}`}>{t.label}</button>
          ))}
        </div>
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm truncate" data-testid="email-template-subject"><span className="text-muted-foreground">Subject:</span> {pv?.subject || "…"}</p>
            <Button size="sm" variant="outline" onClick={send} disabled={busy || !pv} data-testid="email-template-send-sample">{busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}Send me a sample</Button>
          </div>
          <div className="rounded-xl border border-border overflow-hidden bg-[#eef1f6]">
            {pv ? <iframe title="Email preview" srcDoc={pv.html} sandbox="" className="w-full h-[620px] bg-[#eef1f6]" data-testid="email-template-preview" />
              : <div className="h-[620px] grid place-items-center text-sm text-slate-500">Loading preview…</div>}
          </div>
        </div>
      </div>
    </Section>
  );
}

export function ClerkEmails({ data, onSaved, onReset }) {
  const api = useApi();
  const [sec, setSec] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try { onSaved(await api("put", "/admin/settings/clerk", { webhook_secret: sec.trim() })); setSec(""); toast.success("Clerk webhook connected"); }
    catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <Section icon={KeyRound} title="Sign-in & OTP emails" testId="settings-clerk-emails"
      sub="Send sign-in codes, password resets and security notices in your FlexoCards design instead of Clerk's default emails.">
      <p className={`text-sm flex items-center gap-2 ${data.connected ? "text-emerald-500" : "text-amber-500"}`} data-testid="clerk-webhook-status">
        {data.connected ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
        {data.connected ? `Connected (${data.webhook_secret_hint})` : "Not connected. Clerk is still sending its own emails."}</p>
      <ol className="text-xs text-muted-foreground list-decimal pl-5 space-y-1">
        <li>In the Clerk dashboard, open <b>Configure → Webhooks → Add endpoint</b> and paste the URL below.</li>
        <li>Subscribe to the <b>email.created</b> event, save, then copy the <b>Signing Secret</b> (starts with whsec_) here.</li>
        <li>In <b>Configure → Emails</b>, open each template (Verification code, Reset password code, etc.) and turn off <b>Delivered by Clerk</b>.</li>
      </ol>
      <form onSubmit={save} className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5 min-w-0"><Label>Webhook URL</Label><Input readOnly value={data.webhook_url} className="font-mono text-xs" data-testid="clerk-webhook-url" /></div>
        <div className="space-y-1.5 min-w-0"><Label>Signing secret</Label><Input type="password" autoComplete="new-password" required value={sec} onChange={(e) => setSec(e.target.value)} placeholder="whsec_…" data-testid="clerk-webhook-secret-input" /></div>
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          <Button type="submit" disabled={busy} data-testid="clerk-webhook-save-button">{busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Save signing secret</Button>
          {data.connected && <Button type="button" variant="ghost" onClick={onReset} data-testid="clerk-webhook-disconnect"><RotateCcw className="w-4 h-4 mr-1" />Disconnect</Button>}
        </div>
      </form>
    </Section>
  );
}

export function SocialSettings({ data, onSaved }) {
  const api = useApi();
  const [f, setF] = useState(data);
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try { onSaved(await api("put", "/admin/settings/social", f)); toast.success("Social links saved"); }
    catch (err) { toast.error(errMsg(err, "Links must start with https://")); } finally { setBusy(false); }
  };
  return (
    <Section icon={Share2} title="Social media" sub="Links show as icons in the site footer and at the bottom of every email. Leave a field empty to hide it." testId="settings-social">
      <form onSubmit={save} className="grid sm:grid-cols-2 gap-4">
        {SOCIALS.map(([k, label, Icon, ph]) => (
          <div key={k} className="space-y-1.5 min-w-0">
            <Label className="flex items-center gap-2"><Icon className="w-4 h-4" />{label}</Label>
            <Input value={f[k] || ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={ph} data-testid={`social-${k}-input`} />
          </div>
        ))}
        <div className="sm:col-span-2"><Button type="submit" disabled={busy} data-testid="social-save-button">{busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Save social links</Button></div>
      </form>
    </Section>
  );
}
