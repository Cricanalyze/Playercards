import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/800.css";
import "@fontsource/barlow-condensed/900.css";
import "@fontsource/barlow-condensed/700-italic.css";
import "@fontsource/barlow-condensed/900-italic.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { SignIn, SignUp, Show } from "@clerk/react";
import ClerkAuthProvider from "@/components/auth/ClerkAuthProvider";
import { AppDataProvider } from "@/context/AppData";
import { Toaster } from "@/components/ui/sonner";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Home from "@/pages/Home";
import Create from "@/pages/Create";
import Explore from "@/pages/Explore";
import Pricing from "@/pages/Pricing";
import Help from "@/pages/Help";
import Legal from "@/pages/Legal";
import Dashboard from "@/pages/Dashboard";
import Invite from "@/pages/Invite";
import AdminApp from "@/admin/AdminApp";

const ScrollTop = () => {
  const { pathname, hash } = useLocation();
  useEffect(() => { if (!hash) window.scrollTo(0, 0); else document.getElementById(hash.slice(1))?.scrollIntoView(); }, [pathname, hash]);
  return null;
};

const PublicShell = () => (
  <div className="min-h-screen flex flex-col">
    <Header />
    <main className="flex-1"><Outlet /></main>
    <Footer />
  </div>
);

const AuthPage = ({ children }) => (
  <div className="container-x py-12 min-h-[70vh] flex items-center justify-center" data-testid="auth-page">{children}</div>
);

const RequireAccount = ({ children }) => {
  const { pathname, search } = useLocation();
  const back = encodeURIComponent(window.location.origin + pathname + search);
  return (<><Show when="signed-in">{children}</Show><Show when="signed-out"><Navigate to={`/sign-up?redirect_url=${back}`} replace /></Show></>);
};

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <BrowserRouter>
        <ClerkAuthProvider>
          <AppDataProvider>
            <ScrollTop />
            <Routes>
              <Route element={<PublicShell />}>
                <Route path="/" element={<Home />} />
                <Route path="/create" element={<RequireAccount><Create /></RequireAccount>} />
                <Route path="/explore" element={<Explore />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/help" element={<Help />} />
                <Route path="/privacy" element={<Legal kind="privacy" />} />
                <Route path="/terms" element={<Legal kind="terms" />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/invite/:token" element={<Invite />} />
                <Route path="/sign-in/*" element={<AuthPage><SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" withSignUp /></AuthPage>} />
                <Route path="/sign-up/*" element={<AuthPage><SignUp routing="path" path="/sign-up" signInUrl="/sign-in" /></AuthPage>} />
              </Route>
              <Route path="/admin/*" element={<AdminApp />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Toaster richColors position="top-center" />
          </AppDataProvider>
        </ClerkAuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
