import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { LearningModeTabs } from "./learning-mode-tabs";
import { LearningLessonCard } from "./learning-lesson-card";
import { LearningBoardPanel } from "./learning-board-panel";
import {
  getLessonById,
  getLessonsByCategory,
  type LearningCategory,
} from "./learning-data";

const STORAGE_KEY = "chess-app-learning-state";

type PersistedState = {
  mode: LearningCategory;
  lessonId: string | null;
  stepIndex: number;
};

const DEFAULT_STATE: PersistedState = {
  mode: "terms",
  lessonId: null,
  stepIndex: 0,
};

function readPersisted(): PersistedState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const mode: LearningCategory = parsed.mode === "openings" ? "openings" : "terms";
    return {
      mode,
      lessonId: typeof parsed.lessonId === "string" ? parsed.lessonId : null,
      stepIndex: typeof parsed.stepIndex === "number" && parsed.stepIndex >= 0 ? parsed.stepIndex : 0,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function LearningPage() {
  const { t } = useTranslation();

  // Инициализируем дефолтом, чтобы не было SSR-mismatch.
  const [mode, setMode] = useState<LearningCategory>("terms");
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  // Восстанавливаем из localStorage после маунта.
  useEffect(() => {
    const persisted = readPersisted();
    setMode(persisted.mode);
    setLessonId(persisted.lessonId);
    setStepIndex(persisted.stepIndex);
    setHydrated(true);
  }, []);

  // Сохраняем — только после гидрации, чтобы дефолт не затёр сохранённое.
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ mode, lessonId, stepIndex } satisfies PersistedState),
      );
    } catch {
      /* ignore quota */
    }
  }, [mode, lessonId, stepIndex, hydrated]);

  const lessons = useMemo(() => getLessonsByCategory(mode), [mode]);
  const selectedLesson = useMemo(() => {
    const found = getLessonById(lessonId);
    return found && found.category === mode ? found : null;
  }, [lessonId, mode]);

  // Кламп шага, если урок сменился.
  useEffect(() => {
    if (!selectedLesson) return;
    if (stepIndex >= selectedLesson.steps.length) {
      setStepIndex(0);
    }
  }, [selectedLesson, stepIndex]);

  const handleModeChange = (next: LearningCategory) => {
    if (next === mode) return;
    setMode(next);
    setLessonId(null);
    setStepIndex(0);
  };

  const handleLessonSelect = (id: string) => {
    setLessonId(id);
    setStepIndex(0);
  };

  const handlePrev = () => setStepIndex((i) => Math.max(0, i - 1));
  const handleNext = () => {
    if (!selectedLesson) return;
    setStepIndex((i) => Math.min(selectedLesson.steps.length - 1, i + 1));
  };
  const handleReset = () => setStepIndex(0);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {t("learn.sectionTag")}
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold">{t("learn.title")}</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">{t("learn.subtitle")}</p>
      </header>

      <LearningModeTabs value={mode} onChange={handleModeChange} />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4 lg:gap-6">
        {/* Список уроков */}
        <aside className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground px-1">
            {mode === "terms" ? t("learn.listTitle.terms") : t("learn.listTitle.openings")}
          </p>
          <div className="space-y-2">
            {lessons.map((lesson) => (
              <LearningLessonCard
                key={lesson.id}
                lesson={lesson}
                active={lesson.id === selectedLesson?.id}
                onSelect={handleLessonSelect}
              />
            ))}
          </div>
        </aside>

        {/* Доска / детальная панель */}
        <section>
          <LearningBoardPanel
            lesson={selectedLesson}
            stepIndex={stepIndex}
            onPrev={handlePrev}
            onNext={handleNext}
            onReset={handleReset}
          />
        </section>
      </div>
    </div>
  );
}
