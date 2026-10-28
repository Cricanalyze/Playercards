import axios from "axios";
import { useCallback } from "react";
import { useAuth } from "@clerk/react";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function useApi() {
  const { getToken, isSignedIn } = useAuth();
  return useCallback(
    async (method, path, data, params) => {
      const headers = {};
      if (isSignedIn) {
        const t = await getToken();
        if (t) headers.Authorization = `Bearer ${t}`;
      }
      const res = await axios({ method, url: API + path, data, params, headers });
      return res.data;
    },
    [getToken, isSignedIn]
  );
}

export const errMsg = (e, fallback = "Something went wrong. Please try again.") => {
  const d = e?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (d?.message) return d.message;
  if (Array.isArray(d) && d[0]?.msg) return d[0].msg.replace("Value error, ", "");
  return fallback;
};

export const fmtDate = (s) => (s ? new Date(s).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
export const fmtDateTime = (s) => (s ? new Date(s).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
export const newRequestId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`).replace(/[^A-Za-z0-9_-]/g, "");
export const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
