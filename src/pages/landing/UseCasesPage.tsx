import Navbar from "./Navbar.tsx";
import UseCases from "./UseCases.tsx";
import Footer from "./Footer.tsx";

export default function UseCasesPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-16">
        <UseCases />
      </div>
      <Footer />
    </div>
  );
}
