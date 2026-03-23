import Navbar from "./Navbar.tsx";
import Pricing from "./Pricing.tsx";
import Footer from "./Footer.tsx";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-16">
        <Pricing />
      </div>
      <Footer />
    </div>
  );
}
