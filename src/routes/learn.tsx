import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { LearningPage } from "@/components/learning/learning-page";

export const Route = createFileRoute("/learn")({
  head: () => ({
    meta: [
      { title: "Обучение шахматам — Chess Roulette" },
      {
        name: "description",
        content:
          "Учебный раздел Chess Roulette: основные шахматные термины и популярные дебюты с пошаговыми позициями на доске.",
      },
      { property: "og:title", content: "Обучение шахматам — Chess Roulette" },
      {
        property: "og:description",
        content: "Термины и дебюты с интерактивной доской — учитесь играть быстрее.",
      },
    ],
  }),
  component: LearnRoute,
});

function LearnRoute() {
  return (
    <AppShell>
      <LearningPage />
    </AppShell>
  );
}
