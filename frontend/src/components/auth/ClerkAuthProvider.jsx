import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClerkProvider } from "@clerk/react";
import { dark } from "@clerk/ui/themes";
import { useTheme } from "next-themes";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Starts Clerk from the backend's runtime config, so deploy's live keys need no rebuild.
export default function ClerkAuthProvider({ children }) {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const [config, setConfig] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  const isDark = resolvedTheme !== "light";
  const appearance = {
    ...(isDark ? { theme: dark, captcha: { theme: "dark" } } : {}),
    variables: { colorPrimary: "#D4AF37", colorPrimaryForeground: "#0B0F17", fontFamily: "DM Sans, sans-serif", borderRadius: "0.75rem" },
  };

  useEffect(() => {
    let cancelled = false;
    const load = async (attempt = 0) => {
      try {
        const cfg = await (await fetch(`${BACKEND_URL}/api/clerk/config`)).json();
        if (cfg.enabled) return cancelled || setConfig(cfg);
      } catch {}
      if (cancelled) return;
      if (attempt >= 20) return setUnavailable(true);
      setTimeout(() => load(attempt + 1), 1500);
    };
    load();
    return () => { cancelled = true; };
  }, []);

  if (unavailable) return <p style={{ padding: 24 }}>Sign-in is unavailable right now. Refresh the page to try again.</p>;
  if (!config) return null;
  return (
    <ClerkProvider
      publishableKey={config.publishable_key}
      proxyUrl={config.proxy_url || undefined}
      appearance={appearance}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      afterSignOutUrl="/"
    >
      {children}
    </ClerkProvider>
  );
}
