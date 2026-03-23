import { Link } from "react-router-dom";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card/30 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <img
              src="/icon/icon-192.png"
              alt="GroundWork"
              className="w-7 h-7 rounded-md"
            />
            <span className="font-bold text-foreground">
              Ground<span className="text-primary">Work</span>
            </span>
          </Link>

          {/* Links */}
          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <Link to="/features" className="hover:text-foreground transition-colors">Features</Link>
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
