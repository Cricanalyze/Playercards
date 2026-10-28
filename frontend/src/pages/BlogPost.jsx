import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft, Link2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API } from "@/lib/api";
import { fileUrl } from "@/lib/files";
import { Markdown } from "@/components/blog/Markdown";
import { PostCard, PostMeta } from "@/components/blog/PostCard";

export default function BlogPost() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    setData(null); setErr("");
    axios.get(`${API}/blog/${slug}`).then((r) => { setData(r.data); document.title = `${r.data.post.seo_title || r.data.post.title} · FlexoCards`; })
      .catch(() => setErr("This post doesn't exist or isn't published."));
  }, [slug]);
  if (err) return <div className="container-x py-24 text-center" data-testid="blog-post-not-found"><p className="text-muted-foreground">{err}</p><Link to="/blog" className="text-amber-500 hover:underline mt-3 inline-block">Back to blog</Link></div>;
  if (!data) return <div className="container-x py-24 text-center text-muted-foreground">Loading…</div>;
  const { post: p, related } = data;
  const url = window.location.href;
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: p.title, url }); return; } catch { return; } }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${p.title} ${url}`)}`, "_blank");
  };
  return (
    <article className="container-x py-10 sm:py-14" data-testid="blog-post-page">
      <div className="max-w-3xl mx-auto">
        <Link to="/blog" className="text-sm text-muted-foreground hover:text-amber-500 inline-flex items-center gap-1" data-testid="blog-back-link"><ArrowLeft className="w-4 h-4" />All posts</Link>
        {p.category && <p className="eyebrow mt-6">{p.category}</p>}
        <h1 className="font-display font-black uppercase text-4xl sm:text-5xl lg:text-6xl leading-[0.95] tracking-tight mt-2" data-testid="blog-post-title">{p.title}</h1>
        {p.excerpt && <p className="text-muted-foreground mt-4 text-base sm:text-lg">{p.excerpt}</p>}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <PostMeta p={p} />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => navigator.clipboard?.writeText(url).then(() => toast.success("Link copied"))} data-testid="blog-copy-link-button"><Link2 className="w-4 h-4 mr-1" />Copy link</Button>
            <Button size="sm" className="rounded-full font-bold" onClick={share} data-testid="blog-share-button"><Share2 className="w-4 h-4 mr-1" />Share</Button>
          </div>
        </div>
      </div>
      {p.cover_image && <img src={fileUrl(p.cover_image)} alt="" className="w-full max-w-5xl mx-auto mt-8 rounded-2xl aspect-[16/8] object-cover border border-border" data-testid="blog-post-cover" />}
      <div className="max-w-3xl mx-auto mt-10">
        <Markdown testId="blog-post-content">{p.content}</Markdown>
        {p.tags?.length > 0 && <div className="flex flex-wrap gap-2 mt-10" data-testid="blog-post-tags">{p.tags.map((t) => <span key={t} className="px-3 h-7 inline-flex items-center rounded-full border border-border text-xs text-muted-foreground">#{t}</span>)}</div>}
        <div className="mt-12 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div><p className="font-display font-black uppercase text-2xl">Make your own player card</p><p className="text-sm text-muted-foreground">Free account · 2 cards a month</p></div>
          <Button asChild className="rounded-full font-bold" data-testid="blog-cta-create-button"><Link to="/create">Create card</Link></Button>
        </div>
      </div>
      {related.length > 0 && (
        <div className="max-w-5xl mx-auto mt-16">
          <h2 className="font-display font-black uppercase text-2xl mb-5">Related posts</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{related.map((r) => <PostCard key={r.id} p={r} />)}</div>
        </div>
      )}
    </article>
  );
}
