import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { API, errMsg } from "@/lib/api";

export const FAQS = [
  ["Do I need an account to make a card?", "No. You can create and download a card without signing up. An account only lets you save card details and see your plan."],
  ["Are my photos uploaded to your servers?", "No. Your photo is processed inside your browser to build the card. When you save a card to your account, we store the text details only — never the photo."],
  ["Which sports are supported?", "60+ sports and games, from cricket, kabaddi and football to chess, swimming and esports like BGMI and Valorant. Admins can add more any time."],
  ["Can I post directly to WhatsApp or Instagram?", "We don't post for you. On supported phones the Share button opens your phone's share menu with the image. Otherwise download the PNG and add it to your Status or Story manually."],
  ["Are the statistics verified?", "No. All stats, ratings and achievements are entered by you and shown as self-reported. Please be honest."],
  ["Can I use someone else's photo?", "Only if you have their permission (and a parent's permission for anyone under 18). Don't use team logos or photos you don't have rights to."],
  ["How do premium plans work?", "Premium templates need an active entitlement. Online payments are launching soon; until then the team can grant complimentary access for testing and promotions."],
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
