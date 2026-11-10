import { createContext, useCallback, useContext, useEffect, useState } from "react";
import axios from "axios";
import { API } from "@/lib/api";

const Ctx = createContext({ status: null, refresh: () => {} });
export const useSiteStatus = () => useContext(Ctx);

export function SiteStatusProvider({ children }) {
  const [status, setStatus] = useState(null);
  const refresh = useCallback(() => axios.get(`${API}/site/status`).then((r) => setStatus(r.data)).catch(() => setStatus((s) => s || { state: "live", blocked: false })), []);
  useEffect(() => { refresh(); const t = setInterval(refresh, 60000); return () => clearInterval(t); }, [refresh]);
  return <Ctx.Provider value={{ status, refresh }}>{children}</Ctx.Provider>;
}
