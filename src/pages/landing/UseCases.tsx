import { motion } from "motion/react";

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

export default function UseCases() {
  return (
    <section id="usecases" className="py-28 bg-card/30">
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
            Built for field teams
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Whether you manage 3 sites or 300, LogVault scales with your operations.
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
                <h3 className="text-lg font-semibold text-foreground mb-2">{c.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{c.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
