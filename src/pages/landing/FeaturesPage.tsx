import { motion } from "motion/react";
import {
  Camera,
  MapPin,
  FileDown,
  Tag,
  Search,
  ShieldCheck,
  Users,
  BarChart3,
  WifiOff,
  Globe,
  Navigation,
  RefreshCw,
} from "lucide-react";
import Navbar from "./Navbar.tsx";
import Footer from "./Footer.tsx";

const features = [
  {
    icon: Camera,
    title: "Photo-Tagged Logs",
    description:
      "Attach multiple photos directly to any log entry. Visual evidence stays permanently linked to the record it documents. Auto-compressed for fast uploads.",
  },
  {
    icon: MapPin,
    title: "Multi-Site Management",
    description:
      "Organize logs by site or location. Switch between sites instantly and keep all records neatly separated with unique site codes.",
  },
  {
    icon: Tag,
    title: "Custom Categories",
    description:
      "Create your own log types — inspections, maintenance, incidents, audits — and filter by them instantly across all your sites.",
  },
  {
    icon: FileDown,
    title: "Export Reports",
    description:
      "Generate clean PDF, Excel, or CSV reports from any filtered view. Choose themes, date ranges, and categories. Share with clients or archive for compliance.",
  },
  {
    icon: Search,
    title: "Powerful Search & Filters",
    description:
      "Find any entry instantly by date, site, category, keyword, or author. Filter across all sites or drill into a single location.",
  },
  {
    icon: ShieldCheck,
    title: "Audit-Ready Records",
    description:
      "Every log is timestamped, author-stamped, and immutable. Your records stay trustworthy and tamper-evident for compliance or legal needs.",
  },
  {
    icon: Users,
    title: "Team Workspaces",
    description:
      "Create teams, share sites, and manage members with license keys. Control seat counts, transfer admin roles, and collaborate across shared sites.",
  },
  {
    icon: BarChart3,
    title: "Statistics Dashboard",
    description:
      "Visualize your activity with 30-day charts, category breakdowns, and top site rankings. Track your team's logging patterns at a glance.",
  },
  {
    icon: WifiOff,
    title: "Offline-Ready",
    description:
      "Works without an internet connection. Create logs, attach photos, and browse your data offline. Everything syncs automatically when you reconnect.",
  },
  {
    icon: Globe,
    title: "REST API & Webhooks",
    description:
      "Integrate GroundWork with your existing systems. Push log data to external services, trigger automations, and build custom workflows.",
  },
  {
    icon: Navigation,
    title: "GPS Location Tagging",
    description:
      "Auto-capture GPS coordinates with every log entry or pick a location from the map. Site locations auto-fill when creating new entries.",
  },
  {
    icon: RefreshCw,
    title: "Real-Time Collaboration",
    description:
      "Team members see updates across shared sites instantly. Coordinate on site deletions with group voting, and manage roles in real time.",
  },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <section className="pt-28 pb-20 bg-background">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-primary text-sm font-semibold uppercase tracking-widest">
              Features
            </span>
            <h1 className="text-4xl md:text-5xl font-bold mt-3 mb-4 tracking-tight">
              Everything you need to stay organized
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Built from real workflows — not a generic notes app with a new coat of paint.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-2xl overflow-hidden border border-border">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                className="bg-card p-7 active:bg-accent/40 hover:bg-accent/40 transition-colors group"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.04 }}
              >
                <div className="w-12 h-12 rounded-lg bg-primary/15 flex items-center justify-center mb-4 group-hover:bg-primary/25 transition-colors">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg text-foreground mb-2">{feature.title}</h3>
                <p className="text-base text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
