import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API, errMsg } from "@/lib/api";
import { fileUrl } from "@/lib/files";
import { PageSkeleton } from "@/components/Skeletons";

export default function SharedCard() {
  const { shareId } = useParams();
  const [card, setCard] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    axios.get(`${API}/share/${shareId}`).then((r) => { setCard(r.data); document.title = `${r.data.title} · FlexoCards`; })
      .catch((e) => setErr(errMsg(e, "This card link doesn't exist.")));
  }, [shareId]);
  if (err) return (
    <div className="container-x py-24 text-center" data-testid="shared-card-unavailable">
      <p className="text-muted-foreground">{err}</p>
      <Button asChild className="rounded-full font-bold mt-6"><Link to="/create">Make your own card</Link></Button>
    </div>
  );
  if (!card) return <PageSkeleton variant="card" />;
  return (
    <div className="container-x py-10 sm:py-16 grid lg:grid-cols-2 gap-10 items-center" data-testid="shared-card-page">
      <div className="protect flex justify-center stage-grid rounded-3xl border border-border p-6 sm:p-10">
        <img src={fileUrl(card.image_url)} alt={card.title} draggable={false} className="max-h-[70vh] w-auto rounded-xl drop-shadow-[0_20px_40px_rgba(0,0,0,.45)]" data-testid="shared-card-image" />
      </div>
      <div>
        <p className="eyebrow">{card.sport} · Player card</p>
        <h1 className="font-display font-black uppercase text-4xl sm:text-5xl lg:text-6xl leading-[0.95] mt-2" data-testid="shared-card-title">{card.title}</h1>
        <p className="text-muted-foreground mt-3">Made by {card.owner} on FlexoCards.</p>
        <div className="flex flex-wrap gap-2 mt-8">
          <Button asChild className="rounded-full font-bold" data-testid="shared-card-create-button"><Link to="/create">Make your own card</Link></Button>
          <Button variant="outline" className="rounded-full" onClick={() => navigator.clipboard?.writeText(window.location.href).then(() => toast.success("Link copied"))} data-testid="shared-card-copy-button"><Link2 className="w-4 h-4 mr-1" />Copy link</Button>
        </div>
      </div>
    </div>
  );
}
