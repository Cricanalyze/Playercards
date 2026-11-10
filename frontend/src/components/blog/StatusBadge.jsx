const STYLES = {
  published: "border-emerald-500 text-emerald-500",
  pending: "border-amber-500 text-amber-500",
  rejected: "border-destructive text-destructive",
  draft: "border-border text-muted-foreground",
};

export const StatusBadge = ({ status }) => (
  <span data-testid={`post-status-${status}`} className={`inline-flex items-center px-2 h-5 rounded-full border text-[10px] font-bold uppercase ${STYLES[status] || STYLES.draft}`}>
    {status === "pending" ? "In review" : status}
  </span>
);
