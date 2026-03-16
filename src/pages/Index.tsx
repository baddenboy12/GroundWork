import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import Navbar from "./landing/Navbar.tsx";
import Hero from "./landing/Hero.tsx";
import Features from "./landing/Features.tsx";
import UseCases from "./landing/UseCases.tsx";
import Pricing from "./landing/Pricing.tsx";
import Footer from "./landing/Footer.tsx";

function RedirectToDashboard() {
  const navigate = useNavigate();
  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      // Push 10 same-origin entries right after auth so the auth provider's
      // history entry is deeply buried. The PwaBackGuard popstate handler
      // refills this buffer on every back press, keeping the user in the app.
      for (let i = 0; i < 10; i++) {
        window.history.pushState(null, "", "/dashboard");
      }
    }

    navigate("/dashboard", { replace: true });
  }, [navigate]);
  return null;
}

export default function Index() {
  return (
    <>
      <AuthLoading>
        {/* Render nothing while auth state resolves to avoid flicker */}
        <div className="min-h-screen bg-background" />
      </AuthLoading>

      <Authenticated>
        <RedirectToDashboard />
      </Authenticated>

      <Unauthenticated>
        <div className="min-h-screen bg-background">
          <Navbar />
          <Hero />
          <Features />
          <UseCases />
          <Pricing />
          <Footer />
        </div>
      </Unauthenticated>
    </>
  );
}
