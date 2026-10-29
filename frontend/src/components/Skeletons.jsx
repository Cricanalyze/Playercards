const Sk = ({ className = "", style }) => <div className={`skeleton rounded-xl ${className}`} style={style} />;

const Wrap = ({ children, testId = "page-skeleton" }) => (
  <div className="container-x py-10 sm:py-14" data-testid={testId} aria-busy="true" aria-label="Loading">{children}</div>
);

const Head = () => (<><Sk className="h-3 w-24" /><Sk className="h-12 sm:h-16 w-3/4 max-w-xl mt-3" /><Sk className="h-4 w-full max-w-md mt-4" /></>);

export const GridSkeleton = ({ n = 6, aspect = "aspect-[4/3]", cols = "sm:grid-cols-2 lg:grid-cols-3" }) => (
  <div className={`grid ${cols} gap-5`}>{Array.from({ length: n }, (_, i) => <Sk key={i} className={`${aspect} w-full rounded-2xl`} />)}</div>
);

export const ListSkeleton = ({ n = 4 }) => (
  <div className="rounded-2xl border border-border divide-y divide-border">
    {Array.from({ length: n }, (_, i) => (
      <div key={i} className="p-4 flex items-center gap-4"><Sk className="w-12 h-12 shrink-0" /><div className="flex-1 space-y-2"><Sk className="h-4 w-1/2" /><Sk className="h-3 w-1/3" /></div><Sk className="w-8 h-8 shrink-0" /></div>
    ))}
  </div>
);

export function PageSkeleton({ variant = "grid" }) {
  if (variant === "article") return (
    <Wrap testId="article-skeleton"><div className="max-w-3xl mx-auto"><Sk className="h-3 w-20" /><Sk className="h-14 w-full mt-4" /><Sk className="h-14 w-2/3 mt-2" /><Sk className="h-4 w-64 mt-6" /></div>
      <Sk className="w-full max-w-5xl mx-auto aspect-[16/8] mt-8 rounded-2xl" />
      <div className="max-w-3xl mx-auto mt-10 space-y-3">{[100, 95, 98, 80, 92, 60].map((w, i) => <Sk key={i} className="h-4" style={{ width: `${w}%` }} />)}</div></Wrap>
  );
  if (variant === "editor") return (
    <Wrap testId="editor-skeleton"><div className="grid lg:grid-cols-[1fr_420px] gap-8"><div className="flex justify-center"><Sk className="w-full max-w-[420px] aspect-[5/7] rounded-3xl" /></div>
      <div className="space-y-4"><div className="flex gap-2">{[0, 1, 2, 3].map((i) => <Sk key={i} className="h-10 flex-1 rounded-full" />)}</div>{[0, 1, 2, 3, 4].map((i) => <Sk key={i} className="h-12 w-full" />)}<Sk className="h-11 w-full rounded-full" /></div></div></Wrap>
  );
  if (variant === "dashboard") return (
    <Wrap testId="dashboard-skeleton"><Head /><div className="grid sm:grid-cols-3 gap-4 mt-10">{[0, 1, 2].map((i) => <Sk key={i} className="h-28" />)}</div><div className="mt-10"><ListSkeleton n={3} /></div></Wrap>
  );
  if (variant === "card") return (
    <Wrap testId="card-skeleton"><div className="grid lg:grid-cols-2 gap-10 items-center"><Sk className="w-full max-w-md mx-auto aspect-[5/7] rounded-3xl" /><div><Sk className="h-3 w-32" /><Sk className="h-14 w-3/4 mt-3" /><Sk className="h-4 w-1/2 mt-4" /><div className="flex gap-2 mt-8"><Sk className="h-11 w-44 rounded-full" /><Sk className="h-11 w-32 rounded-full" /></div></div></div></Wrap>
  );
  if (variant === "book") return (
    <Wrap testId="book-skeleton"><Head /><div className="flex gap-2 mt-8">{[0, 1, 2].map((i) => <Sk key={i} className="h-10 w-36 rounded-full" />)}</div><Sk className="w-full max-w-[860px] mx-auto h-[56vh] mt-8 rounded-2xl" /></Wrap>
  );
  if (variant === "list") return (<Wrap testId="list-skeleton"><Head /><div className="mt-8"><ListSkeleton /></div></Wrap>);
  return (<Wrap><Head /><div className="mt-10"><GridSkeleton /></div></Wrap>);
}

export const AdminSkeleton = () => (
  <div className="space-y-6" data-testid="admin-skeleton" aria-busy="true"><Sk className="h-10 w-56" /><Sk className="h-4 w-80" />{[0, 1, 2].map((i) => <Sk key={i} className="h-48 w-full" />)}</div>
);

export const SiteSkeleton = () => (
  <div className="min-h-screen" data-testid="site-skeleton" aria-busy="true">
    <div className="border-b border-border"><div className="container-x h-16 flex items-center justify-between gap-4"><Sk className="h-9 w-40" /><div className="hidden md:flex gap-6">{[0, 1, 2, 3, 4].map((i) => <Sk key={i} className="h-3 w-16" />)}</div><Sk className="h-10 w-32 rounded-full" /></div></div>
    <PageSkeleton />
  </div>
);
