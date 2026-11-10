import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { API, errMsg } from "@/lib/api";

export const FAQS = [
  ["What is FlexoCards?", "FlexoCards is a player card maker for cricket and 60+ other sports and esports. Pick a template, add your photo and stats, and download a card ready for WhatsApp, Instagram or print. FlexoCards is a product of Buddy Innovations and Technologies Private Limited."],
  ["Do I need an account to make a card?", "Yes. You need a free FlexoCards account to create, download, share or save a card, even on the Free plan. Sign up with your email or Google in a few seconds."],
  ["How do plans and credits work?", "Free gives 2 cards a month, Basic (₹18/month) 5, Pro (₹45/month) 15 and Team (₹79/month) 40. Yearly plans cost 10× the monthly price. Each download or share uses 1 credit, and credits reset on the 1st of every month."],
  ["How do I pay?", "Payments go through Razorpay, so you can use UPI, cards, netbanking or wallets. Your plan turns on only after the payment is confirmed, and every payment shows up in your dashboard with a receipt sent by email."],
  ["Can I edit a card after I create or download it?", "On paid plans you can keep editing a card for 6 hours after you create it. After that it's locked, so start a new card for changes. On the Free plan a card can't be edited once it's created or downloaded."],
  ["Can I share a public link to my card?", "Public share links are part of paid plans (Basic, Pro and Team). From the download popup, tap \u201cGet public share link\u201d to get a link anyone can open. You can turn it off from your dashboard at any time. Links stop working if your plan ends."],
  ["Why can't I take screenshots or print cards?", "To protect designs and players' photos, FlexoCards blocks the screenshot key, printing and right-click saving on card previews, and blurs cards when you switch away. Some phones and tools can still capture the screen, so please respect other players' cards."],
  ["What is the storybook?", "On Pro and Team plans, every card you download is added to your private storybook. Flip through it like an album, play it as a full-screen story slideshow, or download it as a printable PDF booklet. You can remove any page at any time."],
  ["Are my photos uploaded to your servers?", "Your raw photo never leaves your browser. When you save a card we store only its text details. A finished card image is stored only when you create a public share link, or on Pro and Team plans where downloaded cards go into your private storybook."],
  ["Which sports are supported?", "60+ sports and games, from cricket, kabaddi and football to chess, swimming and esports like BGMI and Valorant. Admins add new sports and templates regularly."],
  ["Can I post directly to WhatsApp or Instagram?", "We don't post for you. On supported phones the Share button opens your phone's share menu with the image. Otherwise download the PNG (or the 9:16 Story PNG) and add it to your Status or Story."],
  ["Can I write for the FlexoCards blog?", "Yes. Ask the FlexoCards team for author access. Once an admin adds you, a \u201cMy blog posts\u201d button appears in your dashboard. Your posts are reviewed before they go live."],
  ["Are the statistics verified?", "No. All stats, ratings and achievements are entered by you and shown as self-reported. Please be honest."],
  ["Can I use someone else's photo?", "Only with their permission (and a parent's permission for anyone under 18). Don't use team logos or photos you don't have rights to."],
  ["I didn't get my sign-in code or receipt email", "Check your spam or promotions folder and wait a minute. Emails come from FlexoCards. If it still doesn't arrive, use the contact form below with your email and we'll help."],
];

export const FaqList = () => (
  <Accordion type="single" collapsible className="w-full">
    {FAQS.map(([q, a], i) => (
      <AccordionItem key={q} value={`f${i}`} data-testid={`faq-item-${i}`}>
        <AccordionTrigger className="text-left font-semibold hover:text-amber-500 hover:no-underline">{q}</AccordionTrigger>
        <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
      </AccordionItem>
    ))}
  </Accordion>
);

export function ContactForm() {
  const [f, setF] = useState({ contact: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await axios.post(`${API}/reports`, { target: "support", ...f });
      toast.success("Message sent. We'll reply to your contact if you left one.");
      setF({ contact: "", reason: "" });
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-3" data-testid="contact-form">
      <Input data-testid="contact-email-input" placeholder="Your email (optional)" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} />
      <Textarea data-testid="contact-message-input" required minLength={3} placeholder="How can we help? To report content, include the link or details." value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} rows={4} />
      <Button data-testid="contact-submit-button" disabled={busy} className="rounded-full font-bold hover:bg-amber-400 hover:text-slate-950">{busy ? "Sending…" : "Send message"}</Button>
    </form>
  );
}
