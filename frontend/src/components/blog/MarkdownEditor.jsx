import { useRef, useState } from "react";
import { toast } from "sonner";
import { Heading2, Heading3, Bold, Italic, Strikethrough, Link2, Quote, List, ListOrdered, Code, Table, Minus, ImagePlus, Loader2 } from "lucide-react";
import { Markdown } from "./Markdown";
import { useUpload } from "./useUpload";

const TOOLS = [
  ["h2", Heading2, "Heading", (s) => `\n## ${s || "Heading"}\n`],
  ["h3", Heading3, "Subheading", (s) => `\n### ${s || "Subheading"}\n`],
  ["bold", Bold, "Bold", (s) => `**${s || "bold text"}**`],
  ["italic", Italic, "Italic", (s) => `*${s || "italic text"}*`],
  ["strike", Strikethrough, "Strikethrough", (s) => `~~${s || "text"}~~`],
  ["link", Link2, "Link", (s) => `[${s || "link text"}](https://)`],
  ["quote", Quote, "Quote", (s) => `\n> ${s || "Quote"}\n`],
  ["ul", List, "Bullet list", (s) => `\n- ${s || "Item"}\n- Item\n`],
  ["ol", ListOrdered, "Numbered list", (s) => `\n1. ${s || "Item"}\n2. Item\n`],
  ["code", Code, "Code", (s) => (s?.includes("\n") ? `\n\`\`\`\n${s}\n\`\`\`\n` : `\`${s || "code"}\``)],
  ["table", Table, "Table", () => "\n| Player | Runs | Wickets |\n| --- | --- | --- |\n| Name | 0 | 0 |\n"],
  ["hr", Minus, "Divider", () => "\n---\n"],
];

export function MarkdownEditor({ value, onChange }) {
  const ref = useRef(null);
  const [tab, setTab] = useState("write");
  const { upload, busy } = useUpload();
  const insert = (fn) => {
    const el = ref.current;
    const [a, b] = [el.selectionStart, el.selectionEnd];
    const text = fn(value.slice(a, b));
    onChange(value.slice(0, a) + text + value.slice(b));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + text.length, a + text.length); });
  };
  const addImage = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const url = await upload(f);
    if (url) { setTab("write"); insert(() => `\n![${f.name.replace(/\.[^.]+$/, "")}](${url})\n`); toast.success("Image added"); }
  };
  return (
    <div className="rounded-xl border border-border overflow-hidden" data-testid="markdown-editor">
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-border bg-muted/40">
        {["write", "preview"].map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} data-testid={`editor-mode-${t}`}
            className={`px-3 h-8 rounded-full text-xs font-bold uppercase transition-colors ${tab === t ? "bg-amber-500 text-slate-950" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>
        ))}
        <span className="w-px h-6 bg-border mx-1" />
        {TOOLS.map(([id, Icon, label, fn]) => (
          <button key={id} type="button" title={label} aria-label={label} disabled={tab !== "write"} onClick={() => insert(fn)} data-testid={`md-tool-${id}`}
            className="w-8 h-8 grid place-items-center rounded-md hover:bg-accent disabled:opacity-30 transition-colors"><Icon className="w-4 h-4" /></button>
        ))}
        <label title="Upload image" className="w-8 h-8 grid place-items-center rounded-md hover:bg-accent cursor-pointer transition-colors" data-testid="md-tool-image">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={addImage} data-testid="md-image-input" />
        </label>
      </div>
      {tab === "write" ? (
        <textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} rows={18} data-testid="post-content-input"
          placeholder="Write your post… Use the toolbar for headings, lists, images and more."
          className="w-full bg-transparent p-4 font-mono text-sm leading-relaxed outline-none resize-y min-h-[320px]" />
      ) : (
        <div className="p-4 min-h-[320px]">{value.trim() ? <Markdown testId="post-content-preview">{value}</Markdown> : <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>}</div>
      )}
    </div>
  );
}
