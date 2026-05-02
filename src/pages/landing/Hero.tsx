import { useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Authenticated, Unauthenticated, useConvexAuth, useQuery } from "convex/react";
import { ArrowRight, CheckCircle, Check, X, LogIn } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth.ts";
import { isNative } from "@/lib/platform";
import PlanCarousel from "@/pages/billing/_components/PlanCarousel.tsx";
import {
  TIER_CONFIG,
  TIER_ORDER,
  type SubscriptionTier,
} from "@/pages/dashboard/_lib/subscription.ts";
import { cn } from "@/lib/utils.ts";
import { api } from "@/convex/_generated/api.js";

const highlights = [
  "Photo-tagged logs",
  "Multi-site management",
  "Team collaboration",
  "Export & reports",
];

const cardTints: Record<string, { border: string; gradient: string }> = {
  free: { border: "border-zinc-500/50", gradient: "linear-gradient(160deg, hsl(240 8% 9%) 0%, hsl(240 5% 7%) 60%, hsl(30 6% 6%) 100%)" },
  pro: { border: "border-blue-500/50", gradient: "linear-gradient(160deg, hsl(220 35% 9%) 0%, hsl(220 20% 7%) 60%, hsl(30 6% 6%) 100%)" },
  business: { border: "border-amber-500/50", gradient: "linear-gradient(160deg, hsl(35 40% 9%) 0%, hsl(35 25% 7%) 60%, hsl(30 6% 6%) 100%)" },
};

export default function Hero() {
  const navigate = useNavigate();
  const { signinRedirect } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const [carouselIndex, setCarouselIndex] = useState(1); // Start on Pro
  // Only runs when authenticated; otherwise skipped. Unauthenticated users are
  // trivially trial-eligible (server-side check in createCheckoutSession is
  // the source of truth).
  const eligibility = useQuery(
    api.users.getTrialEligibility,
    isAuthenticated ? {} : "skip"
  );

  const handleSignUp = (tier: SubscriptionTier) => {
    if (tier !== "free") {
      sessionStorage.setItem("gw_signup_tier", tier);
    }
    void signinRedirect({ prompt: "create" });
  };

  const planCards = TIER_ORDER.map((t) => {
    const cfg = TIER_CONFIG[t];
    const tint = cardTints[t === "starter" ? "pro" : t]!;
    const isPaidTier = t !== "free";
    // Trial badge/CTA: always show for unauthenticated (they're trivially
    // eligible). For authenticated users, wait for the query to resolve and
    // only show if eligible — prevents a "trial available" flash for
    // users who've already used it.
    const showTrial =
      isPaidTier &&
      (!isAuthenticated || eligibility?.eligible === true);

    return (
      <div
        key={t}
        className={cn(
          "relative rounded-2xl border p-4 md:p-5 flex flex-col gap-3",
          tint.border,
        )}
        style={{ background: tint.gradient }}
      >
        {cfg.highlight && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
              Most Popular
            </span>
          </div>
        )}

        <div>
          <p className="font-bold text-foreground text-lg md:text-xl">{cfg.name}</p>
          <p className="text-base md:text-lg text-muted-foreground mt-0.5">{cfg.tagline}</p>
        </div>

        <div>
          <span className="text-3xl md:text-4xl font-black text-foreground">{cfg.price}</span>
          <span className="text-sm md:text-base text-muted-foreground ml-1">{cfg.period}</span>
        </div>

        <ul className="space-y-2 flex-1">
          <li className="flex items-center gap-2 text-base md:text-lg text-muted-foreground">
            <Check className="w-4 h-4 text-primary shrink-0" />
            {cfg.maxSites === null ? "Unlimited sites" : `${cfg.maxSites} site${cfg.maxSites > 1 ? "s" : ""}`}
          </li>
          <li className="flex items-center gap-2 text-base md:text-lg text-muted-foreground">
            <Check className="w-4 h-4 text-primary shrink-0" />
            {cfg.maxLogsPerSite === null ? "Unlimited logs per site" : `${cfg.maxLogsPerSite} log${cfg.maxLogsPerSite > 1 ? "s" : ""} per site`}
          </li>
          <li className="flex items-center gap-2 text-base md:text-lg text-muted-foreground">
            <Check className="w-4 h-4 text-primary shrink-0" />
            Up to {cfg.maxPhotosPerEntry} photos per entry
          </li>
          <li className={cn("flex items-center gap-2 text-base md:text-lg", cfg.export ? "text-muted-foreground" : "text-muted-foreground/40")}>
            {cfg.export ? <Check className="w-4 h-4 text-primary shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
            PDF, Excel & CSV export
          </li>
          <li className={cn("flex items-center gap-2 text-base md:text-lg", cfg.integrations ? "text-muted-foreground" : "text-muted-foreground/40")}>
            {cfg.integrations ? <Check className="w-4 h-4 text-primary shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
            Integrations & API
          </li>
        </ul>

        <Authenticated>
          <Button
            size="lg"
            className="w-full"
            variant={cfg.highlight ? "default" : "secondary"}
            onClick={() => navigate(t === "free" ? "/dashboard" : "/billing")}
          >
            {t === "free"
              ? "Get started free"
              : showTrial
              ? "Start 30-day Free Trial"
              : cfg.highlight
              ? "Upgrade to Pro"
              : `Get ${cfg.name}`}
          </Button>
        </Authenticated>
        <Unauthenticated>
          <Button
            size="lg"
            className="w-full"
            variant={cfg.highlight ? "default" : "secondary"}
            onClick={() => handleSignUp(t)}
          >
            <LogIn className="size-4" />
            {t === "free"
              ? "Sign Up Free"
              : showTrial
              ? "Start 30-day Free Trial"
              : "Sign Up"}
          </Button>
        </Unauthenticated>
      </div>
    );
  });

  return (
    <section className={`relative min-h-dvh flex flex-col overflow-hidden pb-8 md:pb-4 ${isNative ? "pt-40" : "pt-20"}`}>
      {/* Background image with overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1554035042-34f354352d97?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080"
          alt="Field workers"
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 z-0 opacity-5"
        style={{
          backgroundImage: `linear-gradient(oklch(0.94 0.005 250) 1px, transparent 1px), linear-gradient(90deg, oklch(0.94 0.005 250) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Hero text block — sits at top, no flex push. */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 w-full">
        <div className="text-center max-w-3xl mx-auto mt-8 md:mt-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs md:text-sm font-medium mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Structured Logging, Simplified
            </span>
          </motion.div>

          <motion.h1
            className="text-4xl md:text-6xl font-bold leading-tight tracking-tight text-balance mb-3"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Log anything. <span className="text-primary">From anywhere.</span>
          </motion.h1>

          <motion.p
            className="text-sm md:text-base text-muted-foreground mb-3 max-w-xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            The all-purpose log management platform for teams and individuals —
            photo evidence, structured entries, multi-site tracking, and seamless exports.
          </motion.p>

          <motion.div
            className="flex flex-wrap justify-center gap-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {highlights.map((item) => (
              <span key={item} className="flex items-center gap-1.5 text-xs md:text-sm text-muted-foreground">
                <CheckCircle className="w-4 h-4 text-primary" />
                {item}
              </span>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Buttons + carousel block — small fixed margin keeps them just below
          the hero text rather than centering or pushing to the bottom. */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 w-full mt-8 md:mt-12">
        <div className="text-center max-w-3xl mx-auto mb-8 md:mb-10">
          <motion.div
            className="flex flex-wrap justify-center gap-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
          >
            <Authenticated>
              <Button size="lg" className="gap-2" onClick={() => navigate("/dashboard")}>
                Go to Dashboard <ArrowRight className="w-4 h-4" />
              </Button>
            </Authenticated>
            <Unauthenticated>
              <SignInButton size="lg" className="text-lg px-8 py-3 h-auto" />
              <Button size="lg" variant="secondary" className="text-lg px-8 py-3 h-auto" asChild>
                <Link to="/features">Explore Features</Link>
              </Button>
            </Unauthenticated>
          </motion.div>
        </div>

        {/* Plan layout — vertical stack on narrow viewports (<md, e.g. phone
            portrait), 3D carousel from md (768px) up so the Capacitor APK
            (which sets viewport=768) keeps the carousel. */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <div className="md:hidden flex flex-col gap-6 max-w-md mx-auto">
            {planCards}
          </div>
          <div className="hidden md:block">
            <PlanCarousel
              items={planCards}
              frontIndex={carouselIndex}
              onFrontIndexChange={setCarouselIndex}
              height={400}
            />
          </div>
        </motion.div>
      </div>

      {/* Inline footer links — mt-auto pins this to the bottom of the
          section so empty space accumulates between the carousel and
          the footer instead of pushing the footer up under the carousel. */}
      <div className="relative z-10 mt-auto pt-6 pb-4 px-6">
        <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground/60">
          <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            <Link to="/privacy" className="hover:text-muted-foreground transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-muted-foreground transition-colors">Terms of Service</Link>
            <Link to="/refund-policy" className="hover:text-muted-foreground transition-colors">Refund Policy</Link>
            <a href="mailto:groundwork@teezfpo.com" className="hover:text-muted-foreground transition-colors">groundwork@teezfpo.com</a>
          </nav>
          <p>&copy; {new Date().getFullYear()} GroundWork. All rights reserved.</p>
        </div>
      </div>
    </section>
  );
}
