import { motion } from "motion/react";
import { CheckCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Unauthenticated, Authenticated } from "convex/react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const plans = [
  {
    name: "Starter",
    price: "$19",
    period: "/mo",
    description: "Perfect for small teams just getting started.",
    storage: "5 GB photo storage",
    features: [
      "Up to 3 team members",
      "Up to 10 sites",
      "5 GB photo storage",
      "Unlimited log entries",
      "Basic search & filters",
      "CSV export",
    ],
    highlight: false,
    cta: "Get started",
  },
  {
    name: "Professional",
    price: "$59",
    period: "/mo",
    description: "For growing operations that need more power.",
    storage: "50 GB photo storage",
    features: [
      "Up to 15 team members",
      "Unlimited sites",
      "50 GB photo storage",
      "Unlimited log entries",
      "Advanced filters & search",
      "PDF & CSV export",
      "Email alert integrations",
      "Priority support",
    ],
    highlight: true,
    cta: "Start free trial",
  },
  {
    name: "Enterprise",
    price: "$149",
    period: "/mo",
    description: "For large teams with complex multi-site operations.",
    storage: "500 GB photo storage",
    features: [
      "Unlimited team members",
      "Unlimited sites",
      "500 GB photo storage",
      "Unlimited log entries",
      "Custom log categories",
      "PDF & CSV export",
      "Email + webhook integrations",
      "Admin dashboard",
      "Dedicated support",
      "SLA guarantee",
    ],
    highlight: false,
    cta: "Contact sales",
  },
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
            No hidden fees. Cancel anytime. Scale up as your team grows.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              className={`rounded-2xl border p-8 relative ${
                plan.highlight
                  ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                  : "border-border bg-card"
              }`}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              {plan.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                    <Zap className="w-3 h-3" /> Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-foreground mb-1">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground mb-1">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <Authenticated>
                <Button
                  className="w-full"
                  variant={plan.highlight ? "default" : "secondary"}
                  onClick={() => {
                    toast.info("Subscription management coming soon in a future milestone!");
                  }}
                >
                  {plan.cta}
                </Button>
              </Authenticated>
              <Unauthenticated>
                {plan.name === "Enterprise" ? (
                  <Button
                    className="w-full"
                    variant="secondary"
                    onClick={() => toast.info("Contact us at hello@logvault.app")}
                  >
                    Contact sales
                  </Button>
                ) : (
                  <SignInButton className="w-full" />
                )}
              </Unauthenticated>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
