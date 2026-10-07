import { useState } from "react";
import { motion } from "framer-motion";
import TopologyTab from "./TopologyTab";
import SwitchCardsTab from "./SwitchCardsTab";

type Tab = "topology" | "cards";

const TABS: { key: Tab; label: string }[] = [
  { key: "cards", label: "Detay / Kart" },
  { key: "topology", label: "Topoloji" }
];

export default function SwitchesPage() {
  const [tab, setTab] = useState<Tab>("cards");

  return (
    <div>
      <h2 className="text-xl font-semibold text-primary mb-4">Switch Yönetimi</h2>

      <div className="flex gap-1 mb-4 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative px-3 py-2 text-sm -mb-px transition-colors duration-150 ${
              tab === t.key ? "text-accent font-medium" : "text-secondary hover:text-primary"
            }`}
          >
            {t.label}
            {tab === t.key && (
              <motion.span
                layoutId="switches-tab-indicator"
                className="absolute left-0 right-0 -bottom-px h-0.5 bg-accent rounded-full"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
          </button>
        ))}
      </div>

      {tab === "cards" ? <SwitchCardsTab /> : <TopologyTab />}
    </div>
  );
}
