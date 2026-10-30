import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./services/supabase";
import { getAuthorityProfile } from "./services/authorityService";
import AuthorityLoginPage from "./pages/AuthorityLoginPage";
import AuthorityDashboard from "./pages/AuthorityDashboard";
import { Loader2 } from "lucide-react";

export default function App() {
  const [session, setSession] = useState(null);
  const [authority, setAuthority] = useState(null);
  const [loading, setLoading] = useState(true);

  // Authenticate and verify authority profile against Supabase Auth server & public.authorities table.
  // Never trusts cached department, local storage profile, or client-supplied IDs without server verification.
  const verifySession = async () => {
    try {
      // 1. Verify active Supabase user session against the auth server
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        setSession(null);
        setAuthority(null);
        localStorage.removeItem("unisafe_authority");
        localStorage.removeItem("user");
        return null;
      }

      // 2. Fetch and verify matching authority record from public.authorities
      const profile = await getAuthorityProfile(user);
      if (!profile) {
        console.warn("Authenticated user is not registered in public.authorities table.");
        setSession(null);
        setAuthority(null);
        localStorage.removeItem("unisafe_authority");
        localStorage.removeItem("user");
        return null;
      }

      // 3. Confirm valid active session object
      const {
        data: { session: activeSession },
      } = await supabase.auth.getSession();

      setSession(activeSession);
      setAuthority(profile);
      return profile;
    } catch (err) {
      console.error("Session verification error:", err);
      setSession(null);
      setAuthority(null);
      localStorage.removeItem("unisafe_authority");
      localStorage.removeItem("user");
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Listen to all auth state transitions (INITIAL_SESSION, SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;

      if (event === "SIGNED_OUT" || !newSession) {
        setSession(null);
        setAuthority(null);
        setLoading(false);
        localStorage.removeItem("unisafe_authority");
        localStorage.removeItem("user");
      } else if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        await verifySession();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("Sign out error:", e);
    }
    setSession(null);
    setAuthority(null);
    localStorage.removeItem("unisafe_authority");
    localStorage.removeItem("user");
  };

  // 1. Loading state: Do not render either department's dashboard until verification completes
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-400 font-sans">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-9 h-9 text-blue-500 animate-spin" />
          <p className="text-xs tracking-wider uppercase font-semibold text-slate-400">
            Initializing UniSafe Authority Portal...
          </p>
        </div>
      </div>
    );
  }

  const isAuthenticated = Boolean(session && authority);

  return (
    <BrowserRouter>
      <Routes>
        {/* Root: Show AuthorityLoginPage if unauthenticated, AuthorityDashboard if authenticated */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <AuthorityDashboard authority={authority} onLogout={handleLogout} />
            ) : (
              <AuthorityLoginPage onLoginSuccess={verifySession} />
            )
          }
        />

        {/* Dedicated Authority Authentication Route */}
        <Route
          path="/authority/login"
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <AuthorityLoginPage onLoginSuccess={verifySession} />
            )
          }
        />

        {/* Protected Authority Route */}
        <Route
          path="/authority"
          element={
            isAuthenticated ? (
              <AuthorityDashboard authority={authority} onLogout={handleLogout} />
            ) : (
              <Navigate to="/authority/login" replace />
            )
          }
        />

        {/* Fallbacks */}
        <Route path="/login" element={<Navigate to="/authority/login" replace />} />
        <Route path="/auth" element={<Navigate to="/authority/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
