import { useEffect, useState } from "react";
import axios from "axios";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { API } from "@/lib/api";
import { PostCard } from "@/components/blog/PostCard";

export default function Blog() {
  const [f, setF] = useState({ q: "", category: "", page: 1 });
  const [q, setQ] = useState("");
  const [data, setData] = useState(null);
  useEffect(() => { document.title = "Blog · FlexoCards"; }, []);
  useEffect(() => { axios.get(`${API}/blog`, { params: f }).then((r) => setData(r.data)).catch(() => setData({ posts: [], categories: [], pages: 1 })); }, [f]);
  const posts = data?.posts || [];
  return (
    <div className="container-x py-10 sm:py-14" data-testid="blog-page">
      <p className="eyebrow">FlexoCards blog</p>
      <h1 className="font-display font-black uppercase text-4xl sm:text-5xl lg:text-6xl tracking-tight mt-2">Stories, tips & game day</h1>
      <p className="text-muted-foreground mt-3 max-w-2xl text-sm sm:text-base">Card design ideas, player stories and how-tos from the FlexoCards team and community writers.</p>
      <form onSubmit={(e) => { e.preventDefault(); setF({ ...f, q, page: 1 }); }} className="mt-8 flex gap-2 max-w-lg">
        <div className="relative flex-1"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search posts" className="pl-9 rounded-full" data-testid="blog-search-input" /></div>
        <Button type="submit" className="rounded-full font-bold" data-testid="blog-search-button">Search</Button>
      </form>
      {data?.categories?.length > 0 && (
        <div className="flex gap-2 mt-5 overflow-x-auto pb-1 [scrollbar-width:none]" data-testid="blog-categories">
          {["", ...data.categories].map((c) => (
            <button key={c || "all"} onClick={() => setF({ ...f, category: c, page: 1 })} data-testid={`blog-category-${c || "all"}`}
              className={`shrink-0 px-4 h-9 rounded-full border text-xs font-bold uppercase transition-colors ${f.category === c ? "bg-amber-500 text-slate-950 border-amber-500" : "border-border text-muted-foreground hover:text-foreground"}`}>{c || "All"}</button>
          ))}
        </div>
      )}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-10" data-testid="blog-post-list">
        {data === null ? [0, 1, 2].map((i) => <div key={i} className="aspect-[4/3] rounded-2xl bg-muted animate-pulse" />)
          : posts.length === 0 ? <p className="text-muted-foreground col-span-full" data-testid="blog-empty">No posts yet. Check back soon.</p>
          : posts.map((p, i) => <PostCard key={p.id} p={p} big={i === 0 && f.page === 1 && !f.q} />)}
      </div>
      {data?.pages > 1 && (
        <div className="flex justify-center gap-2 mt-10">
          <Button variant="outline" className="rounded-full" disabled={f.page <= 1} onClick={() => setF({ ...f, page: f.page - 1 })} data-testid="blog-prev-page">Previous</Button>
          <span className="text-sm self-center text-muted-foreground">Page {f.page} of {data.pages}</span>
          <Button variant="outline" className="rounded-full" disabled={f.page >= data.pages} onClick={() => setF({ ...f, page: f.page + 1 })} data-testid="blog-next-page">Next</Button>
        </div>
      )}
    </div>
  );
}
