import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { LearningLesson } from "./learning-data";

interface LearningLessonCardProps {
  lesson: LearningLesson;
  active: boolean;
  onSelect: (id: string) => void;
}

export function LearningLessonCard({ lesson, active, onSelect }: LearningLessonCardProps) {
  const { t } = useTranslation();
  const stepsCount = lesson.steps.length;

  return (
    <button
      type="button"
      onClick={() => onSelect(lesson.id)}
      aria-pressed={active}
      className={cn(
        "group w-full text-left rounded-2xl border-2 p-3 transition-all",
        "flex items-center gap-3",
        active
          ? "border-primary bg-primary/10 shadow-[0_0_24px_-8px_var(--glow-emerald)]"
          : "border-border/50 bg-background/40 hover:border-border hover:bg-white/5",
      )}
    >
      <div
        className={cn(
          "grid place-items-center h-11 w-11 shrink-0 rounded-xl text-xl transition-colors",
          active
            ? "bg-gradient-primary text-primary-foreground"
            : "bg-white/5 text-foreground/80 group-hover:bg-white/10",
        )}
      >
        <span aria-hidden>{lesson.icon ?? "♟"}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 min-w-0">
          <p className="font-display font-semibold text-sm leading-tight truncate">
            {lesson.titleRu}
          </p>
          {lesson.titleEn && (
            <span className="text-[11px] text-muted-foreground truncate">{lesson.titleEn}</span>
          )}
        </div>
        {lesson.subtitle && (
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{lesson.subtitle}</p>
        )}
      </div>
      {lesson.category === "openings" && stepsCount > 1 && (
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            active
              ? "bg-primary/20 text-primary-foreground"
              : "bg-white/5 text-muted-foreground",
          )}
        >
          {t("learn.stepsCount", { count: stepsCount })}
        </span>
      )}
    </button>
  );
}
