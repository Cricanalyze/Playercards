import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { Show } from "@clerk/react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API, useApi, errMsg, fmtDateTime } from "@/lib/api";
import { useAppData } from "@/context/AppData";

export default function Invite() {
  const { token } = useParams();
  const api = useApi();
  const nav = useNavigate();
  const { refreshMe } = useAppData();
  const [inv, setInv] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { axios.get(`${API}/invitations/${token}`).then((r) => setInv(r.data)).catch((e) => setErr(errMsg(e))); }, [token]);
  const back = encodeURIComponent(window.location.href);
  const accept = async () => {
    setBusy(true);
    try { const r = await api("post", "/invitations/accept", { token }); toast.success(`You're now ${r.role.replace("_", " ")}`); await refreshMe(); nav("/admin"); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div className="container-x py-20 max-w-lg" data-testid="invite-page">
      <ShieldCheck className="w-10 h-10 text-amber-500" />
      <h1 className="font-display font-black uppercase text-4xl mt-4">Team invitation</h1>
      {err && <p className="text-destructive mt-4" data-testid="invite-error">{err}</p>}
      {inv && (
        <div className="mt-4 space-y-4">
          <p className="text-muted-foreground">You've been invited to join the RivalCard team as <b className="text-foreground uppercase">{inv.role.replace("_", " ")}</b>. It's for <b className="text-foreground">{inv.email_hint}</b> and expires {fmtDateTime(inv.expires_at)}.</p>
          {inv.status !== "pending" ? <p className="text-destructive" data-testid="invite-status">This invitation is {inv.status}.</p> : (
            <>
              <Show when="signed-out">
                <p className="text-sm">Create your own account (or sign in) with that email, then come back to this link.</p>
                <div className="flex gap-2">
                  <Button asChild className="rounded-full font-bold" data-testid="invite-sign-up-button"><Link to={`/sign-up?redirect_url=${back}`}>Create account</Link></Button>
                  <Button asChild variant="outline" className="rounded-full" data-testid="invite-sign-in-button"><Link to={`/sign-in?redirect_url=${back}`}>Sign in</Link></Button>
                </div>
              </Show>
              <Show when="signed-in"><Button onClick={accept} disabled={busy} className="rounded-full font-bold" data-testid="invite-accept-button">{busy ? "Accepting…" : "Accept invitation"}</Button></Show>
            </>
          )}
        </div>
      )}
    </div>
  );
}
