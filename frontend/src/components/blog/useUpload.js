import { useState } from "react";
import { toast } from "sonner";
import { useApi, errMsg } from "@/lib/api";

export function useUpload() {
  const api = useApi();
  const [busy, setBusy] = useState(false);
  const upload = async (file) => {
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be 5 MB or smaller."); return ""; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      return (await api("post", "/uploads/image", fd)).url;
    } catch (e) { toast.error(errMsg(e, "Upload failed")); return ""; } finally { setBusy(false); }
  };
  return { upload, busy };
}
