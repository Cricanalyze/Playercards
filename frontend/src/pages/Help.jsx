import { FaqList, ContactForm } from "@/components/Support";

const GUIDES = [
  ["Download on Android", "Tap Card PNG or Story PNG. The image saves to Downloads / Gallery. If nothing happens, long-press the preview image in the popup and choose “Download image”."],
  ["Download on iPhone", "Tap the button, then in the popup long-press the image → “Save to Photos”. Safari may show a download icon in the address bar instead."],
  ["Share to WhatsApp Status", "Tap Share and pick WhatsApp if your phone offers it. Otherwise open WhatsApp → Updates → My status → choose the saved image."],
  ["Share to Instagram Story", "Use the Story PNG (9:16). Open Instagram → + → Story → pick the image from your gallery."],
  ["Photo looks off-centre", "Open the Photo step and use zoom and the sliders, or drag directly on the card preview."],
  ["Forgot your password?", "On the Sign in page, enter your email, then choose “Forgot password?” to receive a secure reset code. We never see or set your password."],
];

export default function Help() {
  return (
    <div className="container-x py-12" data-testid="help-page">
      <p className="eyebrow">Help centre</p>
      <h1 className="font-display font-black uppercase text-4xl sm:text-5xl lg:text-6xl">How can we help?</h1>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
        {GUIDES.map(([t, d]) => <div key={t} className="rounded-2xl border border-border bg-card p-5"><p className="font-semibold">{t}</p><p className="text-sm text-muted-foreground mt-2">{d}</p></div>)}
      </div>
      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-12 mt-16">
        <div><h2 className="font-display font-black uppercase text-3xl mb-4">FAQ</h2><FaqList /></div>
        <div id="contact" className="rounded-2xl border border-border bg-card p-6 h-fit">
          <h2 className="font-display font-black uppercase text-2xl">Contact support</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-5">Report content, ask about plans or account help.</p>
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
