import { useEffect } from "react";
import { toast } from "sonner";

const MSG = "Screenshots and printing are disabled on FlexoCards.";

// Best-effort: browsers can't fully block OS or phone screenshots.
export default function ScreenGuard() {
  useEffect(() => {
    const b = document.body;
    const hide = () => b.classList.add("guard-hidden");
    const show = () => b.classList.remove("guard-hidden");
    const flash = () => { hide(); setTimeout(show, 1500); toast.error(MSG, { id: "guard" }); };
    const down = (e) => {
      const k = (e.key || "").toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (k === "p" || k === "s")) { e.preventDefault(); toast.error(MSG, { id: "guard" }); }
      if (e.metaKey && e.shiftKey && ["3", "4", "5", "s"].includes(k)) flash();
      if (k === "printscreen") flash();
    };
    const up = (e) => {
      if ((e.key || "").toLowerCase() !== "printscreen") return;
      navigator.clipboard?.writeText("").catch(() => {});
      flash();
    };
    const block = (e) => { if (e.target.closest?.(".protect")) e.preventDefault(); };
    const vis = () => (document.hidden ? hide() : show());
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    window.addEventListener("blur", hide);
    window.addEventListener("focus", show);
    window.addEventListener("beforeprint", hide);
    window.addEventListener("afterprint", show);
    document.addEventListener("visibilitychange", vis);
    document.addEventListener("contextmenu", block);
    document.addEventListener("dragstart", block);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
      window.removeEventListener("blur", hide);
      window.removeEventListener("focus", show);
      window.removeEventListener("beforeprint", hide);
      window.removeEventListener("afterprint", show);
      document.removeEventListener("visibilitychange", vis);
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("dragstart", block);
    };
  }, []);
  return null;
}
