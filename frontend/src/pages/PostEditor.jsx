import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useAppData } from "@/context/AppData";
import { useApi, errMsg } from "@/lib/api";
import { fileUrl } from "@/lib/files";
import { MarkdownEditor } from "@/components/blog/MarkdownEditor";
import { useUpload } from "@/components/blog/useUpload";
import { StatusBadge } from "@/components/blog/StatusBadge";

const EMPTY = { title: "", excerpt: "", content: "", cover_image: "", category: "", tags: [], seo_title: "", seo_description: "", featured: false, status: "draft" };

const Field = ({ label, hint, children }) => (
  <div className="space-y-1.5"><Label>{label}</Label>{children}{hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}</div>
);

function Cover({ value, onChange }) {
  const { upload, busy } = useUpload();
  const pick = async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { const u = await upload(f); if (u) onChange(u); } };
  return value ? (
    <div className="relative rounded-xl overflow-hidden border border-border" data-testid="post-cover-preview">
      <img src={fileUrl(value)} alt="" className="w-full aspect-[16/9] object-cover" />
      <button type="button" onClick={() => onChange("")} aria-label="Remove cover" data-testid="post-cover-remove" className="absolute top-2 right-2 w-8 h-8 grid place-items-center rounded-full bg-slate-950/80 text-white"><X className="w-4 h-4" /></button>
    </div>
  ) : (
    <label className="aspect-[16/9] rounded-xl border-2 border-dashed border-border grid place-items-center cursor-pointer hover:border-amber-500 transition-colors text-sm text-muted-foreground" data-testid="post-cover-upload">
      <span className="flex flex-col items-center gap-2">{busy ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImagePlus className="w-6 h-6" />}Upload cover image</span>
      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={pick} data-testid="post-cover-input" />
    </label>
  );
}

export default function PostEditor() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const { me } = useAppData();
  const api = useApi();
  const nav = useNavigate();
  const [p, setP] = useState(isNew ? EMPTY : null);
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState("");
  useEffect(() => {
    if (isNew || !me?.member?.can_blog) return;
    api("get", `/me/posts/${id}`).then((d) => { setP(d); setTags((d.tags || []).join(", ")); }).catch((e) => { toast.error(errMsg(e)); nav("/write"); });
  }, [id, me]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!me) return <div className="container-x py-24 text-center text-muted-foreground">Loading…</div>;
  if (!me.member.can_blog) return <Navigate to="/dashboard" replace />;
  if (!p) return <div className="container-x py-24 text-center text-muted-foreground">Loading post…</div>;
  const editor = me.member.perms.includes("blog.manage");
  const set = (k) => (e) => setP({ ...p, [k]: e?.target ? e.target.value : e });

  const save = async (status) => {
    if (p.title.trim().length < 3) return toast.error("Add a title (at least 3 characters).");
    setBusy(status);
    const body = { ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, p[k] ?? EMPTY[k]])), status, tags: tags.split(",").map((t) => t.trim()).filter(Boolean) };
    try {
      const r = isNew ? await api("post", "/me/posts", body) : await api("put", `/me/posts/${id}`, body);
      toast.success({ published: "Post published", pending: "Sent for review", draft: "Draft saved" }[r.status]);
      if (isNew) nav(`/write/${r.id}`, { replace: true }); else setP(r);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(""); }
  };
  const B = ({ status, label, primary }) => (
    <Button type="button" onClick={() => save(status)} disabled={!!busy} variant={primary ? "default" : "outline"} className="rounded-full font-bold" data-testid={`post-save-${status}-button`}>
      {busy === status && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}{label}
    </Button>
  );

  return (
    <div className="container-x py-8 sm:py-10" data-testid="post-editor-page">
      <Link to={editor ? "/admin/blog" : "/write"} className="text-sm text-muted-foreground hover:text-amber-500 inline-flex items-center gap-1" data-testid="post-editor-back"><ArrowLeft className="w-4 h-4" />Back</Link>
      <div className="flex flex-wrap items-end justify-between gap-4 mt-4">
        <div><p className="eyebrow flex items-center gap-2">{isNew ? "New post" : "Edit post"} {!isNew && <StatusBadge status={p.status} />}</p>
          <h1 className="font-display font-black uppercase text-3xl sm:text-4xl">{p.title || "Untitled post"}</h1></div>
        <div className="flex flex-wrap gap-2">
          <B status="draft" label="Save draft" />
          {editor ? <B status="published" label={p.status === "published" ? "Update" : "Publish"} primary /> : <B status="pending" label="Submit for review" primary />}
        </div>
      </div>
      {p.status === "rejected" && p.review_note && <p className="mt-4 rounded-lg border border-destructive/50 p-3 text-sm text-destructive" data-testid="post-review-note">Admin note: {p.review_note}</p>}
      {!editor && p.status === "published" && <p className="mt-4 text-xs text-muted-foreground">Saving changes to a published post sends it back for review.</p>}
      <div className="grid lg:grid-cols-[1fr_340px] gap-6 mt-8 items-start">
        <div className="space-y-5 min-w-0">
          <Field label="Title"><Input value={p.title} onChange={set("title")} maxLength={160} className="text-lg h-12" data-testid="post-title-input" /></Field>
          <Field label="Short summary" hint="Shown on the blog list and in link previews."><Textarea value={p.excerpt} onChange={set("excerpt")} maxLength={300} rows={2} data-testid="post-excerpt-input" /></Field>
          <Field label="Content"><MarkdownEditor value={p.content} onChange={set("content")} /></Field>
        </div>
        <aside className="space-y-5 lg:sticky lg:top-24 rounded-2xl border border-border p-5">
          <Field label="Cover image"><Cover value={p.cover_image} onChange={set("cover_image")} /></Field>
          <Field label="Category"><Input value={p.category} onChange={set("category")} maxLength={40} placeholder="e.g. Cricket" data-testid="post-category-input" /></Field>
          <Field label="Tags" hint="Separate with commas."><Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="cricket, tips" data-testid="post-tags-input" /></Field>
          <Field label="SEO title" hint={`${p.seo_title.length}/70`}><Input value={p.seo_title} onChange={set("seo_title")} maxLength={70} data-testid="post-seo-title-input" /></Field>
          <Field label="SEO description" hint={`${p.seo_description.length}/170`}><Textarea value={p.seo_description} onChange={set("seo_description")} maxLength={170} rows={3} data-testid="post-seo-description-input" /></Field>
          {editor && <div className="flex items-center justify-between"><Label>Feature at top of blog</Label><Switch checked={p.featured} onCheckedChange={set("featured")} data-testid="post-featured-switch" /></div>}
        </aside>
      </div>
    </div>
  );
}
