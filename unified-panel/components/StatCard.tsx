import { motion } from "framer-motion";
import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  gradient: string;
  shadowColor: string;
  delay?: number;
}

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  gradient,
  shadowColor,
  delay = 0,
}: StatCardProps) {
  // This component is kept for backward compatibility but not used in new dashboard
  // New dashboard uses inline card components for better control
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      whileHover={{ scale: 1.05, y: -5 }}
      className="medical-card hover:shadow-lg transition-all"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-slate-600">{title}</p>
        {icon && <div className="text-2xl">{icon}</div>}
      </div>
      <p className="text-3xl font-bold text-slate-900 mb-1">{value}</p>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
    </motion.div>
  );
}

