import { createContext, useCallback, useContext, useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "@clerk/react";
import { API, useApi } from "@/lib/api";

const Ctx = createContext(null);

export function AppDataProvider({ children }) {
  const { isSignedIn, isLoaded } = useAuth();
  const api = useApi();
  const [sports, setSports] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [plans, setPlans] = useState([]);
  const [me, setMe] = useState(null);
  const [meError, setMeError] = useState("");

  const loadCatalog = useCallback(async () => {
    const [s, t, p] = await Promise.all([axios.get(`${API}/sports`), axios.get(`${API}/templates`), axios.get(`${API}/plans`)]);
    setSports(s.data); setTemplates(t.data); setPlans(p.data);
  }, []);

  const refreshMe = useCallback(async () => {
    if (!isSignedIn) { setMe(null); return; }
    try { setMe(await api("get", "/me")); setMeError(""); }
    catch (e) { setMe(null); setMeError(e?.response?.data?.detail || "Could not load account"); }
  }, [api, isSignedIn]);

  useEffect(() => { loadCatalog().catch(() => {}); }, [loadCatalog]);
  useEffect(() => { if (isLoaded) refreshMe(); }, [isLoaded, refreshMe]);

  return (
    <Ctx.Provider value={{ sports, templates, plans, me, meError, refreshMe, loadCatalog, isSignedIn }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAppData = () => useContext(Ctx);
