import { FaqList, ContactForm } from "@/components/Support";
import { PageHero } from "@/components/arena/Bits";

const GUIDES = [
  ["Download on Android", "Tap Card PNG or Story PNG. The image saves to Downloads / Gallery. If nothing happens, long-press the preview image in the popup and choose “Download image”."],
  ["Download on iPhone", "Tap the button, then in the popup long-press the image → “Save to Photos”. Safari may show a download icon in the address bar instead."],
  ["Share to WhatsApp Status", "Tap Share and pick WhatsApp if your phone offers it. Otherwise open WhatsApp → Updates → My status → choose the saved image."],
  ["Share to Instagram Story", "Use the Story PNG (9:16). Open Instagram → + → Story → pick the image from your gallery."],
  ["Photo looks off-centre", "Open the Photo step and use zoom and the sliders, or drag directly on the card preview."],
  ["Forgot your password?", "On the Sign in page, enter your email, then choose “Forgot password?” to receive a secure reset code. We never see or set your password."],
];
const TILT = [-1.2, 0.8, -0.5, 1.3, -0.9, 0.5];

export default function Help() {
  return (
    <div data-testid="help-page">
      <PageHero eyebrow="Help centre" title="How can we help?" />
      <div className="container-x py-14">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
          {GUIDES.map(([t, d], i) => (
            <div key={t} className="paper lift relative rounded-md border border-border p-6 pt-7" style={{ transform: `rotate(${TILT[i]}deg)` }} data-testid={`help-guide-${i + 1}`}>
              <span className="tape" />
              <p className="font-mono text-[10px] uppercase tracking-widest text-amber-600 dark:text-amber-400">Guide 0{i + 1}</p>
              <p className="font-poster font-black uppercase text-2xl leading-none mt-2">{t}</p>
              <p className="text-sm text-muted-foreground mt-3">{d}</p>
            </div>
          ))}
        </div>
        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-12 mt-20">
          <div><h2 className="font-poster font-black uppercase text-4xl mb-4">FAQ</h2><FaqList /></div>
          <div id="contact" className="paper relative rounded-md border border-border p-6 h-fit rotate-[0.6deg]">
            <span className="tape" />
            <h2 className="font-poster font-black uppercase text-3xl">Contact support</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-5">Report content, ask about plans or account help.</p>
            <ContactForm />
          </div>
        </div>
      </div>
    </div>
  );
}
