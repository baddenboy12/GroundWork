import { motion } from "motion/react";
import {
  Camera,
  MapPin,
  FileDown,
  Tag,
  Search,
  ShieldCheck,
} from "lucide-react";

const features = [
  {
    icon: Camera,
    title: "Photo-Tagged Logs",
    description:
      "Attach multiple photos directly to any log entry. Visual evidence stays permanently linked to the record it documents.",
  },
  {
    icon: MapPin,
    title: "Multi-Site Management",
    description:
      "Organize logs by site or location. Switch between sites instantly and keep all records neatly separated.",
  },
  {
    icon: Tag,
    title: "Custom Categories & Tags",
    description:
      "Create your own log types — inspections, maintenance, incidents, audits — and filter by them instantly.",
  },
  {
    icon: FileDown,
    title: "Export Reports",
    description:
      "Generate clean PDF or CSV reports from any filtered view. Share with clients or archive for compliance.",
  },
  {
    icon: Search,
    title: "Powerful Search & Filters",
    description:
      "Find any entry instantly by date, site, category, keyword, or author — no scrolling through endless notes.",
  },
  {
    icon: ShieldCheck,
    title: "Audit-Ready Records",
    description:
      "Every log is timestamped, author-stamped, and immutable. Your records stay trustworthy and tamper-evident.",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-28 bg-background">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <span className="text-primary text-sm font-semibold uppercase tracking-widest">
            Features
          </span>
          <h2 className="text-4xl md:text-5xl font-bold mt-3 mb-4 tracking-tight">
            Everything your team needs
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Built from real field workflows — not a generic notes app with a new coat of paint.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-2xl overflow-hidden border border-border">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              className="bg-card p-7 hover:bg-accent/40 transition-colors group"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
            >
              <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center mb-4 group-hover:bg-primary/25 transition-colors">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
