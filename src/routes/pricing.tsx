import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/app-shell";
import { PricingCard, PLANS } from "@/components/pricing-modal";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Chess Roulette" },
      { name: "description", content: "Plans for casual players, serious students, and clubs." },
    ],
  }),
  component: Pricing,
});

function Pricing() {
  const { t } = useTranslation();
  const faqKeys = ["cancel", "coach", "trial"] as const;
  return (
    <AppShell>
      <div className="text-center max-w-2xl mx-auto mb-12">
        <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-full bg-gradient-primary text-primary-foreground mb-4">
          <Sparkles className="h-3 w-3" /> {t("pricing.kicker")}
        </div>
        <h1 className="font-display font-bold text-4xl lg:text-5xl tracking-tight">
          {t("pricing.title")}
        </h1>
        <p className="mt-4 text-muted-foreground">
          {t("pricing.subtitle")}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4 max-w-5xl mx-auto">
        {PLANS.map((p) => (
          <PricingCard key={p.id} plan={p} />
        ))}
      </div>


      <div className="mt-16 max-w-3xl mx-auto">
        <h2 className="font-display font-bold text-2xl text-center mb-6">{t("pricing.faq")}</h2>
        <div className="space-y-3">
          {faqKeys.map((k) => (
            <Card key={k} className="p-4">
              <p className="font-semibold">{t(`pricing.faqs.${k}.q` as const)}</p>
              <p className="text-sm text-muted-foreground mt-1">{t(`pricing.faqs.${k}.a` as const)}</p>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
