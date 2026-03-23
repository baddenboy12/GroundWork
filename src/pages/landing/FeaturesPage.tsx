import { motion } from "motion/react";
import {
  Camera,
  MapPin,
  FileDown,
  Search,
  Users,
  BarChart3,
  WifiOff,
  Navigation,
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
    icon: Users,
    title: "Team Workspaces",
    description:
      "Create teams, share sites, and manage members with license keys. Control seat counts, transfer admin roles, and collaborate across shared sites.",
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
    icon: Navigation,
    title: "GPS Location Tagging",
    description:
      "Auto-capture GPS coordinates with every log entry or pick a location from the map. Site locations auto-fill when creating new entries.",
  },
];

const cases = [
  {
    image:
      "https://images.unsplash.com/photo-1697289936356-4ea59e238e41?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600",
    title: "Tower & Telecom Inspections",
    description:
      "Log every tower visit with geo-tagged photos of antenna conditions, cable runs, and generator health. Track recurring issues across your tower portfolio.",
  },
  {
    image:
      "https://images.unsplash.com/photo-1526593646509-03c680561a15?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600",
    title: "Generator Maintenance",
    description:
      "Record fuel levels, oil changes, load tests, and fault codes with photo evidence. Build a complete service history for every generator unit.",
  },
  {
    image:
      "https://images.unsplash.com/photo-1562601622-e3ea198a61e4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600",
    title: "Site Surveys & Audits",
    description:
      "Document site conditions before and after work. Attach before/after photos and generate compliance-ready PDF reports in one click.",
  },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Features */}
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

      {/* Use Cases */}
      <section className="py-20 bg-card/30">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-primary text-sm font-semibold uppercase tracking-widest">
              Use Cases
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mt-3 mb-4 tracking-tight">
              Built for teams everywhere
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Whether you manage 3 sites or 300, GroundWork scales with your operations.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {cases.map((c, i) => (
              <motion.div
                key={c.title}
                className="rounded-2xl overflow-hidden border border-border bg-card group"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <div className="relative overflow-hidden h-52">
                  <img
                    src={c.image}
                    alt={c.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-foreground mb-2">{c.title}</h3>
                  <p className="text-base text-muted-foreground leading-relaxed">{c.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
