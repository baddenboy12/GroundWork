import { motion } from "motion/react";
import { CheckCircle, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Unauthenticated, Authenticated } from "convex/react";
import { useNavigate } from "react-router-dom";
import {
  TIER_CONFIG,
  type SubscriptionTier,
} from "@/pages/dashboard/_lib/subscription.ts";

// Show the 2 paid tiers on the marketing page
const DISPLAYED_TIERS: SubscriptionTier[] = ["pro", "business"];

type FeatureRow = { label: string; starter: boolean; pro: boolean; business: boolean; skipFor?: SubscriptionTier[] };

const FEATURE_ROWS: FeatureRow[] = [
  { label: "Up to 15 sites", starter: true, pro: true, business: false, skipFor: ["business"] },
  { label: "Unlimited sites", starter: false, pro: false, business: true, skipFor: ["pro", "starter"] },
  { label: "Unlimited logs/site", starter: true, pro: true, business: true },
  { label: "Photo attachments", starter: true, pro: true, business: true },
  { label: "PDF, Excel & CSV export", starter: false, pro: false, business: true },
  { label: "Integrations & API", starter: false, pro: false, business: true },

];

export default function Pricing() {
  const navigate = useNavigate();

  return (
    <section id="pricing" className="py-28 bg-background">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <span className="text-primary text-sm font-semibold uppercase tracking-widest">
            Pricing
          </span>
          <h2 className="text-4xl md:text-5xl font-bold mt-3 mb-4 tracking-tight">
            Simple, transparent pricing
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Two simple plans. No hidden fees, cancel anytime.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start max-w-3xl mx-auto w-full">
          {DISPLAYED_TIERS.map((tier, i) => {
            const cfg = TIER_CONFIG[tier];
            return (
              <motion.div
                key={tier}
                className={`rounded-2xl border p-8 relative ${
                  cfg.highlight
                    ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                    : "border-border bg-card"
                }`}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                {cfg.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                      <Zap className="w-3 h-3" /> Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-foreground mb-1">{cfg.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{cfg.tagline}</p>
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-bold text-foreground">{cfg.price}</span>
                    <span className="text-muted-foreground mb-1">/{cfg.period.replace("per ", "")}</span>
                  </div>
                </div>

                <ul className="space-y-2.5 mb-8">
                  {FEATURE_ROWS.filter((row) => !row.skipFor?.includes(tier)).map((row) => {
                    const included = row[tier as "starter" | "pro" | "business"];
                    return (
                      <li
                        key={row.label}
                        className={`flex items-center gap-2.5 text-sm ${
                          included ? "text-muted-foreground" : "text-muted-foreground/35"
                        }`}
                      >
                        {included ? (
                          <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                        ) : (
                          <X className="w-4 h-4 shrink-0" />
                        )}
                        {row.label}
                      </li>
                    );
                  })}
                </ul>

                <Authenticated>
                  <Button
                    className="w-full"
                    variant={cfg.highlight ? "default" : "secondary"}
                    onClick={() => navigate("/billing")}
                  >
                    {cfg.highlight ? "Upgrade to Pro" : `Get ${cfg.name}`}
                  </Button>
                </Authenticated>
                <Unauthenticated>
                  <SignInButton className="w-full" />
                </Unauthenticated>
              </motion.div>
            );
          })}
        </div>


      </div>
    </section>
  );
}
