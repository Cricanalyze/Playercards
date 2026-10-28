import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/context/AppData";
import { useApi, errMsg, fmtDate } from "@/lib/api";
import { StatusBadge } from "@/components/blog/StatusBadge";

export default function Write() {
  const { me } = useAppData();
  const api = useApi();
  const [posts, setPosts] = useState(null);
  const load = () => api("get", "/me/posts").then(setPosts).catch(() => setPosts([]));
  useEffect(() => { if (me?.member?.can_blog) load(); }, [me]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!me) return <div className="container-x py-24 text-center text-muted-foreground">Loading…</div>;
  if (!me.member.can_blog) return <Navigate to="/dashboard" replace />;
  const del = async (id) => {
    if (!window.confirm("Delete this post? This cannot be undone.")) return;
    try { await api("delete", `/me/posts/${id}`); toast.success("Post deleted"); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  const editor = me.member.perms.includes("blog.manage");
  return (
    <div className="container-x py-10" data-testid="my-posts-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">Blog</p><h1 className="font-display font-black uppercase text-4xl sm:text-5xl">My posts</h1>
          <p className="text-sm text-muted-foreground mt-1">{editor ? "You can publish posts directly." : "Your posts go to an admin for review before they appear on the blog."}</p></div>
        <Button asChild className="rounded-full font-bold" data-testid="new-post-button"><Link to="/write/new"><Plus className="w-4 h-4 mr-1" />New post</Link></Button>
      </div>
      <div className="mt-8 rounded-2xl border border-border divide-y divide-border" data-testid="my-posts-list">
        {posts === null ? <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          : posts.length === 0 ? <p className="p-6 text-sm text-muted-foreground" data-testid="my-posts-empty">No posts yet. Write your first one.</p>
          : posts.map((p) => (
            <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3" data-testid={`my-post-${p.id}`}>
              <div className="min-w-0">
                <p className="font-semibold truncate">{p.title}</p>
                <p className="text-xs text-muted-foreground flex flex-wrap gap-2 items-center mt-1"><StatusBadge status={p.status} />Updated {fmtDate(p.updated_at)}{p.status === "published" && ` · ${p.views || 0} views`}</p>
                {p.status === "rejected" && p.review_note && <p className="text-xs text-destructive mt-1">Admin note: {p.review_note}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                {p.status === "published" && <Button asChild size="icon" variant="ghost" data-testid={`my-post-view-${p.id}`}><Link to={`/blog/${p.slug}`} aria-label="View"><ExternalLink className="w-4 h-4" /></Link></Button>}
                <Button asChild size="icon" variant="ghost" data-testid={`my-post-edit-${p.id}`}><Link to={`/write/${p.id}`} aria-label="Edit"><Pencil className="w-4 h-4" /></Link></Button>
                <Button size="icon" variant="ghost" onClick={() => del(p.id)} data-testid={`my-post-delete-${p.id}`} aria-label="Delete"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
