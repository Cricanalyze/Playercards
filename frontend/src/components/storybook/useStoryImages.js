import { useEffect, useRef, useState } from "react";
import { useApi } from "@/lib/api";

// Loads private storybook images (auth required) as object URLs.
export function useStoryImages(pages) {
  const api = useApi();
  const [urls, setUrls] = useState({});
  const blobs = useRef({});
  useEffect(() => {
    let alive = true;
    pages.filter((p) => !blobs.current[p.id]).forEach(async (p) => {
      try {
        const blob = await api("get", `/me/storybook/${p.id}/image`, null, null, { responseType: "blob" });
        if (!alive) return;
        blobs.current[p.id] = blob;
        setUrls((u) => ({ ...u, [p.id]: URL.createObjectURL(blob) }));
      } catch { /* missing image shows placeholder */ }
    });
    return () => { alive = false; };
  }, [pages]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => Object.values(urls).forEach((u) => URL.revokeObjectURL(u)), []); // eslint-disable-line react-hooks/exhaustive-deps
  return { urls, blobs: blobs.current };
}
