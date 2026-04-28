import { BookOpen, Library } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { LearningCategory } from "./learning-data";

interface LearningModeTabsProps {
  value: LearningCategory;
  onChange: (next: LearningCategory) => void;
}

export function LearningModeTabs({ value, onChange }: LearningModeTabsProps) {
  const { t } = useTranslation();

  const tabs: { id: LearningCategory; label: string; icon: typeof BookOpen }[] = [
    { id: "terms", label: t("learn.modes.terms"), icon: BookOpen },
    { id: "openings", label: t("learn.modes.openings"), icon: Library },
  ];

  return (
    <div className="glass-panel-strong rounded-2xl p-1.5 inline-flex gap-1 w-full sm:w-auto">
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            aria-pressed={active}
            className={cn(
              "flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all",
              active
                ? "glass-button text-emerald-50"
                : "text-foreground/70 hover:text-foreground hover:bg-white/5",
            )}
          >
            <tab.icon className="h-4 w-4" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
