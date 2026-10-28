import { Instagram, Facebook, Youtube, Linkedin, Twitter, MessageCircle, Send, AtSign } from "lucide-react";

export const SOCIALS = [
  ["instagram", "Instagram", Instagram, "https://instagram.com/yourpage"],
  ["facebook", "Facebook", Facebook, "https://facebook.com/yourpage"],
  ["x", "X (Twitter)", Twitter, "https://x.com/yourhandle"],
  ["youtube", "YouTube", Youtube, "https://youtube.com/@yourchannel"],
  ["linkedin", "LinkedIn", Linkedin, "https://linkedin.com/company/yourcompany"],
  ["whatsapp", "WhatsApp", MessageCircle, "https://wa.me/919999999999"],
  ["telegram", "Telegram", Send, "https://t.me/yourchannel"],
  ["threads", "Threads", AtSign, "https://threads.net/@yourhandle"],
];

export const SocialIcons = ({ links, className = "" }) => {
  const items = SOCIALS.filter(([k]) => links?.[k]);
  if (!items.length) return null;
  return (
    <div className={`flex flex-wrap gap-2 ${className}`} data-testid="social-links">
      {items.map(([k, label, Icon]) => (
        <a key={k} href={links[k]} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} data-testid={`social-link-${k}`}
          className="w-9 h-9 grid place-items-center rounded-full border border-border text-muted-foreground hover:text-slate-950 hover:bg-amber-500 hover:border-amber-500 transition-colors">
          <Icon className="w-4 h-4" />
        </a>
      ))}
    </div>
  );
};
