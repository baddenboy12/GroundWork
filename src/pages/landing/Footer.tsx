export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card/30 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <a href="/" className="flex items-center gap-3">
            <img
              src="/icon/icon-192.png"
              alt="GroundWork"
              className="w-7 h-7 rounded-md"
            />
            <span className="font-bold text-foreground">
              Ground<span className="text-primary">Work</span>
            </span>
          </a>

{/* Copyright */}
          <p className="text-sm text-muted-foreground">
            &copy; {year} GroundWork. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
