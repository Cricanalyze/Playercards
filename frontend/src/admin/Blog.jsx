import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, ExternalLink, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi, errMsg, fmtDate } from "@/lib/api";
import { StatusBadge } from "@/components/blog/StatusBadge";
import { PageHead } from "./AdminApp";

function Authors() {
  const api = useApi();
  const [list, setList] = useState([]);
  const [email, setEmail] = useState("");
  const load = () => api("get", "/admin/blog/authors").then(setList).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const add = async (e) => {
    e.preventDefault();
    try { const r = await api("post", "/admin/blog/authors", { email }); toast.success(`${r.email} can now write blog posts`); setEmail(""); load(); } catch (err) { toast.error(errMsg(err)); }
  };
  const remove = async (u) => { try { await api("delete", `/admin/blog/authors/${u.user_id}`); toast.success("Blog access removed"); load(); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <div className="rounded-xl border border-border p-5" data-testid="blog-authors">
      <p className="font-semibold">Blog authors</p>
      <p className="text-xs text-muted-foreground mt-1">Give any player blog access. Their posts come to you for review before publishing.</p>
      <form onSubmit={add} className="flex gap-2 mt-4">
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="player@email.com" data-testid="blog-author-email-input" />
        <Button type="submit" data-testid="blog-author-add-button">Add</Button>
      </form>
      <div className="mt-4 divide-y divide-border">
        {list.length === 0 ? <p className="text-sm text-muted-foreground py-2" data-testid="blog-authors-empty">No authors yet.</p> : list.map((u) => (
          <div key={u.user_id} className="py-2 flex items-center justify-between gap-2 text-sm" data-testid={`blog-author-${u.user_id}`}>
            <span className="min-w-0 truncate">{u.name} <span className="text-muted-foreground">{u.email} · {u.posts} posts</span></span>
            <Button size="icon" variant="ghost" onClick={() => remove(u)} aria-label="Remove author" data-testid={`blog-author-remove-${u.user_id}`}><UserMinus className="w-4 h-4" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Blog() {
  const api = useApi();
  const [status, setStatus] = useState("all");
  const [posts, setPosts] = useState(null);
  const load = () => api("get", "/admin/blog/posts", null, { status: status === "all" ? "" : status }).then(setPosts).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps
  const setSt = async (p, st) => {
    const note = st === "rejected" ? window.prompt("Reason for the author (optional)") ?? null : "";
    if (note === null) return;
    try { await api("patch", `/admin/blog/posts/${p.id}/status`, { status: st, note }); toast.success(`Post ${st === "draft" ? "unpublished" : st}`); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  const del = async (p) => {
    if (!window.confirm(`Delete “${p.title}”?`)) return;
    try { await api("delete", `/me/posts/${p.id}`); toast.success("Post deleted"); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div data-testid="admin-blog">
      <PageHead title="Blog" sub="Write and publish posts, review submissions from authors, and manage who can write.">
        <Button asChild data-testid="admin-new-post-button"><Link to="/write/new"><Plus className="w-4 h-4 mr-1" />New post</Link></Button>
      </PageHead>
      <div className="grid xl:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="min-w-0">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44 mb-3" data-testid="admin-blog-status-filter"><SelectValue /></SelectTrigger>
            <SelectContent>{[["all", "All posts"], ["pending", "In review"], ["published", "Published"], ["draft", "Drafts"], ["rejected", "Rejected"]].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
          </Select>
          <div className="rounded-xl border border-border overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Author</TableHead><TableHead>Status</TableHead><TableHead>Updated</TableHead><TableHead>Views</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {(posts || []).map((p) => (
                  <TableRow key={p.id} data-testid={`admin-post-row-${p.id}`}>
                    <TableCell className="font-medium max-w-[260px] truncate">{p.title}</TableCell>
                    <TableCell className="text-sm">{p.author_name}</TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{fmtDate(p.updated_at)}</TableCell>
                    <TableCell className="text-sm">{p.views || 0}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        {p.status !== "published" && <Button size="sm" onClick={() => setSt(p, "published")} data-testid={`admin-post-publish-${p.id}`}>Publish</Button>}
                        {p.status === "pending" && <Button size="sm" variant="outline" onClick={() => setSt(p, "rejected")} data-testid={`admin-post-reject-${p.id}`}>Reject</Button>}
                        {p.status === "published" && <Button size="sm" variant="outline" onClick={() => setSt(p, "draft")} data-testid={`admin-post-unpublish-${p.id}`}>Unpublish</Button>}
                        {p.status === "published" && <Button asChild size="icon" variant="ghost"><Link to={`/blog/${p.slug}`} aria-label="View" data-testid={`admin-post-view-${p.id}`}><ExternalLink className="w-4 h-4" /></Link></Button>}
                        <Button asChild size="icon" variant="ghost"><Link to={`/write/${p.id}`} aria-label="Edit" data-testid={`admin-post-edit-${p.id}`}><Pencil className="w-4 h-4" /></Link></Button>
                        <Button size="icon" variant="ghost" onClick={() => del(p)} aria-label="Delete" data-testid={`admin-post-delete-${p.id}`}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {posts?.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6" data-testid="admin-blog-empty">No posts here.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </div>
        <Authors />
      </div>
    </div>
  );
}
