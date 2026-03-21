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
      transition={{ duration: 0.25 }}
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        <BillingInner onBack={onBack} />
      </motion.div>
    </motion.div>
  );
}
