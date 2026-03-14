import Navbar from "./landing/Navbar.tsx";
import Hero from "./landing/Hero.tsx";
import Features from "./landing/Features.tsx";
import UseCases from "./landing/UseCases.tsx";
import Pricing from "./landing/Pricing.tsx";
import Footer from "./landing/Footer.tsx";

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <Features />
      <UseCases />
      <Pricing />
      <Footer />
    </div>
  );
}
