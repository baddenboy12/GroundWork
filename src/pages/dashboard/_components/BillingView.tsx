import { motion } from "motion/react";
import { BillingInner } from "@/pages/billing/page.tsx";

type Props = {
  onBack: () => void;
};

export default function BillingView({ onBack }: Props) {
  return (
    <motion.div
      className="flex-1 overflow-y-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <BillingInner onBack={onBack} />
    </motion.div>
  );
}
