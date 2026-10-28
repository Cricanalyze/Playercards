import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CATEGORY_LABELS } from "@/lib/cardUtils";

export function SportsGrid({ sports, onSelect, selectedId, compact = false, linkMode = false }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const list = useMemo(() => sports.filter((s) => (cat === "all" || s.category === cat) && s.name.toLowerCase().includes(q.toLowerCase())), [sports, q, cat]);
  const cats = ["all", ...Object.keys(CATEGORY_LABELS)];
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input data-testid="sport-search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${sports.length} sports & games…`} className="pl-9 h-11 rounded-full" />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none]">
        {cats.map((c) => (
          <button key={c} data-testid={`sport-category-${c}`} onClick={() => setCat(c)}
            className={`shrink-0 text-xs font-bold uppercase tracking-wider px-3 h-8 rounded-full border transition-colors ${cat === c ? "bg-amber-500 text-slate-950 border-amber-500" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"}`}>
            {c === "all" ? "All" : CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>
      <div className={`grid gap-2 ${compact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"}`}>
        {list.map((s) => {
          const cls = `text-left px-3 py-3 rounded-lg border transition-colors ${selectedId === s.id ? "border-amber-500 bg-amber-500/10" : "border-border hover:border-amber-500/60 hover:bg-accent"}`;
          const inner = (<><div className="font-display font-bold uppercase text-base leading-tight truncate">{s.name}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{CATEGORY_LABELS[s.category]}</div></>);
          return linkMode
            ? <Link key={s.id} to={`/create?sport=${s.id}`} data-testid={`sport-option-${s.id}`} className={cls}>{inner}</Link>
            : <button key={s.id} data-testid={`sport-option-${s.id}`} onClick={() => onSelect(s)} className={cls}>{inner}</button>;
        })}
        {list.length === 0 && <p className="col-span-full text-sm text-muted-foreground py-6" data-testid="sport-search-empty">No sport matches “{q}”. Try “Other Esports” or ask us to add it.</p>}
      </div>
    </div>
  );
}
