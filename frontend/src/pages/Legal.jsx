const PRIVACY = [
  ["What we collect", "Without an account: nothing personal. We count anonymous events (which sport and template was used, and when a card was downloaded) to improve the product. With an account: your email, name, saved card text details, plan and subscription records."],
  ["Your photos", "Photos are processed in your browser to render your card. They are not uploaded to our servers and are not stored with saved cards. There are no public profiles."],
  ["Minors", "If you are under 18, use RivalCard with a parent or guardian's permission. Do not upload photos of other minors without their guardian's consent."],
  ["Other people's photos", "Only use photos you own or have permission to use. Do not use official team logos, league marks or copyrighted game artwork."],
  ["Authentication", "Sign-in is handled by our authentication provider (Clerk). We never see or store your password."],
  ["Deleting your data", "From My Cards you can delete your saved data at any time. You can also delete your login account from the account menu. Contact support for full removal."],
  ["Security", "Admin actions are permission-checked on our server and recorded in an audit log. Payment card details will never be stored by us; payments, when enabled, are handled by a certified gateway."],
];

const TERMS = [
  ["Using RivalCard", "You may create cards for personal, team and non-commercial promotional use. You are responsible for the content you add."],
  ["Self-reported information", "Stats, ratings, rankings and achievements on cards are entered by users and are not verified by RivalCard."],
  ["Intellectual property", "RivalCard templates are original artwork. You may share cards you create. Do not resell templates or remove the watermark from free exports."],
  ["Prohibited content", "No hateful, sexual, violent or impersonating content, and no content that infringes others' rights. We may suspend accounts that break these rules."],
  ["Plans & payments", "Paid plan terms (one-time or recurring, cancellation and refunds) are shown on the Pricing page and apply at the time of purchase."],
  ["Changes", "We may update these terms. Material changes will be announced on the website."],
];

export default function Legal({ kind }) {
  const items = kind === "privacy" ? PRIVACY : TERMS;
  return (
    <div className="container-x py-12 max-w-3xl" data-testid={`legal-${kind}-page`}>
      <p className="eyebrow">Legal</p>
      <h1 className="font-display font-black uppercase text-4xl sm:text-5xl">{kind === "privacy" ? "Privacy Policy" : "Terms of Use"}</h1>
      <p className="text-sm text-muted-foreground mt-2">Plain-language summary for the MVP. Have this reviewed by a lawyer before a commercial launch.</p>
      <div className="mt-10 space-y-8">
        {items.map(([t, d]) => <section key={t}><h2 className="font-display font-bold uppercase text-xl">{t}</h2><p className="text-muted-foreground mt-2">{d}</p></section>)}
      </div>
    </div>
  );
}
