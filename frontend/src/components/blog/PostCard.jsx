import { Link } from "react-router-dom";
import { Clock } from "lucide-react";
import { fmtDate } from "@/lib/api";
import { fileUrl } from "@/lib/files";

export const PostMeta = ({ p }) => (
  <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
    <span>{p.author_name}</span><span>{fmtDate(p.published_at)}</span>
    <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{p.reading_minutes} min read</span>
  </p>
);

export function PostCard({ p, big = false }) {
  return (
    <Link to={`/blog/${p.slug}`} data-testid={`blog-post-card-${p.slug}`}
      className={`group paper lift relative rounded-md border border-border p-3 pb-2 flex flex-col hover:border-amber-500/60 ${big ? "md:flex-row md:col-span-full md:gap-4" : ""}`}>
      <span className="tape" />
      <div className={`bg-muted overflow-hidden rounded-sm ${big ? "md:w-3/5 aspect-[16/9]" : "aspect-[16/9]"}`}>
        {p.cover_image
          ? <img src={fileUrl(p.cover_image)} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
          : <div className="w-full h-full night grid place-items-center font-poster font-black uppercase text-3xl text-amber-400/70">FlexoCards</div>}
      </div>
      <div className={`p-3 pt-4 flex flex-col gap-2 ${big ? "md:w-2/5 md:p-8 md:justify-center" : ""}`}>
        {p.category && <p className="eyebrow">{p.category}</p>}
        <h3 className={`font-poster font-black uppercase leading-[0.95] group-hover:text-amber-500 transition-colors ${big ? "text-4xl sm:text-5xl" : "text-2xl"}`}>{p.title}</h3>
        {p.excerpt && <p className="text-sm text-muted-foreground line-clamp-3">{p.excerpt}</p>}
        <PostMeta p={p} />
      </div>
    </Link>
  );
}
