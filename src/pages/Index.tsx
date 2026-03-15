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
