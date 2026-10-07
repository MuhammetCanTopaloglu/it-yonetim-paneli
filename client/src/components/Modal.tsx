import type { ReactNode } from "react";
import { motion } from "framer-motion";

export default function Modal({
  title,
  onClose,
  children
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-surface border shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h3 className="font-semibold text-primary">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="text-tertiary hover:text-primary text-lg leading-none transition-colors duration-150"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </motion.div>
    </motion.div>
  );
}
