export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card/30 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img
              src="https://cdn.hercules.app/file_Ntyxh5KPFwMSNtrnKtE21IB8"
              alt="GroundWork"
              className="w-7 h-7 rounded-md"
            />
            <span className="font-bold text-foreground">
              Log<span className="text-primary">Vault</span>
            </span>
          </div>

          {/* Links */}
          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#usecases" className="hover:text-foreground transition-colors">Use Cases</a>
          </div>

          {/* Copyright */}
          <p className="text-sm text-muted-foreground">
            &copy; {year} GroundWork. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
