import { motion } from "motion/react";
import { Button } from "@/components/ui/button.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Authenticated, Unauthenticated } from "convex/react";
import { ArrowRight, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const highlights = [
  "Photo-tagged logs",
  "Multi-site management",
  "Team collaboration",
  "Export & reports",
];

export default function Hero() {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
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

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-24">
        <div className="max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-sm font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Field Operations, Simplified
            </span>
          </motion.div>

          <motion.h1
            className="text-5xl md:text-7xl font-bold leading-tight tracking-tight text-balance mb-6"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Log anything.
            <br />
            <span className="text-primary">From anywhere.</span>
          </motion.h1>

          <motion.p
            className="text-xl text-muted-foreground mb-8 max-w-xl leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            LogVault is the all-purpose field log management platform built for teams who need more than sticky notes — photo evidence, structured entries, multi-site tracking, and seamless exports.
          </motion.p>

          <motion.div
            className="flex flex-wrap gap-3 mb-10"
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
            className="flex flex-wrap gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Authenticated>
              <Button size="lg" className="gap-2" onClick={() => navigate("/dashboard")}>
                Go to Dashboard <ArrowRight className="w-4 h-4" />
              </Button>
            </Authenticated>
            <Unauthenticated>
              <SignInButton />
              <Button size="lg" variant="secondary" asChild>
                <a href="#pricing">View Pricing</a>
              </Button>
            </Unauthenticated>
          </motion.div>
        </div>
      </div>

      {/* Floating stats */}
      <motion.div
        className="absolute bottom-12 right-8 md:right-16 z-10 hidden md:flex gap-6"
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, delay: 0.6 }}
      >
        {[
          { value: "100+", label: "Site types" },
          { value: "∞", label: "Log entries" },
          { value: "3", label: "Team tiers" },
        ].map((stat) => (
          <div key={stat.label} className="text-center bg-card/60 backdrop-blur-sm border border-border rounded-xl px-5 py-4">
            <div className="text-2xl font-bold text-primary">{stat.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
          </div>
        ))}
      </motion.div>
    </section>
  );
}
