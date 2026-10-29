import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Gift, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApi, errMsg } from "@/lib/api";
import { useAppData } from "@/context/AppData";

const KEY = "fc_ref";

// Saves ?ref=CODE, then claims it once the visitor has a new account.
export function ReferralCapture() {
  const api = useApi();
  const { me, refreshMe } = useAppData();
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("ref");
    if (code && /^[A-Za-z0-9]{6}$/.test(code)) localStorage.setItem(KEY, code.toUpperCase());
  }, []);
  useEffect(() => {
    const code = localStorage.getItem(KEY);
    if (!code || !me?.member) return;
    localStorage.removeItem(KEY);
    api("post", "/me/referral/claim", { code }).then((r) => { toast.success(`Welcome gift: ${r.bonus_cards} free bonus cards added!`); refreshMe(); }).catch(() => {});
  }, [me]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function ReferralCard() {
  const api = useApi();
  const [r, setR] = useState(null);
  useEffect(() => { api("get", "/me/referral").then(setR).catch((e) => toast.error(errMsg(e))); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!r || !r.enabled) return null;
  const link = `${window.location.origin}/?ref=${r.code}`;
  const share = async () => {
    const text = `Make your own player card on FlexoCards and get ${r.reward_cards} free bonus cards: ${link}`;
    if (navigator.share) { try { await navigator.share({ text }); } catch { /* cancelled */ } return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };
  return (
    <div className="rounded-2xl border border-amber-500/50 bg-amber-500/5 p-5" data-testid="referral-card">
      <p className="font-semibold flex items-center gap-2"><Gift className="w-4 h-4 text-amber-500" />Invite friends, get free cards</p>
      <p className="text-sm text-muted-foreground mt-1">You and each friend who signs up with your link both get <b>{r.reward_cards} bonus cards</b>.</p>
      <div className="flex gap-2 mt-3">
        <input readOnly value={link} className="flex-1 min-w-0 h-9 rounded-full border border-border bg-muted px-3 text-xs font-mono" data-testid="referral-link" />
        <Button size="sm" variant="outline" className="rounded-full" onClick={() => navigator.clipboard?.writeText(link).then(() => toast.success("Invite link copied"))} data-testid="referral-copy"><Copy className="w-4 h-4" /></Button>
        <Button size="sm" className="rounded-full font-bold" onClick={share} data-testid="referral-share"><Share2 className="w-4 h-4 mr-1" />Share</Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2" data-testid="referral-stats">{r.count} friend{r.count === 1 ? "" : "s"} joined · {r.earned} cards earned</p>
    </div>
  );
}
