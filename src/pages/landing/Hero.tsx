import { useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Authenticated, Unauthenticated } from "convex/react";
import { ArrowRight, CheckCircle, Check, X, LogIn } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth.ts";
import PlanCarousel from "@/pages/billing/_components/PlanCarousel.tsx";
import {
  TIER_CONFIG,
  TIER_ORDER,
  type SubscriptionTier,
} from "@/pages/dashboard/_lib/subscription.ts";
import { cn } from "@/lib/utils.ts";

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
  const [carouselIndex, setCarouselIndex] = useState(1); // Start on Pro

  const handleSignUp = (tier: SubscriptionTier) => {
    if (tier !== "free") {
      sessionStorage.setItem("gw_signup_tier", tier);
    }
    void signinRedirect({ prompt: "create" });
  };

  const planCards = TIER_ORDER.map((t) => {
    const cfg = TIER_CONFIG[t];
    const tint = cardTints[t === "starter" ? "pro" : t]!;

    return (
      <div
        key={t}
        className={cn(
          "relative rounded-2xl border p-4 flex flex-col gap-3",
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
          <p className="font-bold text-foreground text-xl">{cfg.name}</p>
          <p className="text-lg text-muted-foreground mt-0.5 whitespace-nowrap">{cfg.tagline}</p>
        </div>

        <div>
          <span className="text-4xl font-black text-foreground">{cfg.price}</span>
          <span className="text-base text-muted-foreground ml-1">{cfg.period}</span>
        </div>

        <ul className="space-y-2 flex-1">
          <li className="flex items-center gap-2 text-lg text-muted-foreground whitespace-nowrap">
            <Check className="w-4 h-4 text-primary shrink-0" />
            {cfg.maxSites === null ? "Unlimited sites" : `${cfg.maxSites} site${cfg.maxSites > 1 ? "s" : ""}`}
          </li>
          <li className="flex items-center gap-2 text-lg text-muted-foreground whitespace-nowrap">
            <Check className="w-4 h-4 text-primary shrink-0" />
            {cfg.maxLogsPerSite === null ? "Unlimited logs per site" : `${cfg.maxLogsPerSite} log${cfg.maxLogsPerSite > 1 ? "s" : ""} per site`}
          </li>
          <li className="flex items-center gap-2 text-lg text-muted-foreground whitespace-nowrap">
            <Check className="w-4 h-4 text-primary shrink-0" />
            Up to {cfg.maxPhotosPerEntry} photos per entry
          </li>
          <li className={cn("flex items-center gap-2 text-lg whitespace-nowrap", cfg.export ? "text-muted-foreground" : "text-muted-foreground/40")}>
            {cfg.export ? <Check className="w-4 h-4 text-primary shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
            PDF, Excel & CSV export
          </li>
          <li className={cn("flex items-center gap-2 text-lg whitespace-nowrap", cfg.integrations ? "text-muted-foreground" : "text-muted-foreground/40")}>
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
            {t === "free" ? "Get started free" : cfg.highlight ? "Upgrade to Pro" : `Get ${cfg.name}`}
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
            {t === "free" ? "Sign Up Free" : "Sign Up"}
          </Button>
        </Unauthenticated>
      </div>
    );
  });

  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden pt-20 pb-8">
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

      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full">
        {/* Hero text — compact */}
        <div className="text-center max-w-3xl mx-auto mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-sm font-medium mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Structured Logging, Simplified
            </span>
          </motion.div>

          <motion.h1
            className="text-4xl md:text-6xl font-bold leading-tight tracking-tight text-balance mb-4"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Log anything. <span className="text-primary">From anywhere.</span>
          </motion.h1>

          <motion.p
            className="text-base text-muted-foreground mb-5 max-w-xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            The all-purpose log management platform for teams and individuals —
            photo evidence, structured entries, multi-site tracking, and seamless exports.
          </motion.p>

          <motion.div
            className="flex flex-wrap justify-center gap-3 mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {highlights.map((item) => (
              <span key={item} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CheckCircle className="w-4 h-4 text-primary" />
                {item}
              </span>
            ))}
          </motion.div>

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
              <SignInButton size="lg" />
              <Button size="lg" variant="secondary" asChild>
                <Link to="/features">Explore Features</Link>
              </Button>
            </Unauthenticated>
          </motion.div>
        </div>

        {/* Plan carousel */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <PlanCarousel
            items={planCards}
            frontIndex={carouselIndex}
            onFrontIndexChange={setCarouselIndex}
          />
        </motion.div>
      </div>
    </section>
  );
}
