import { Crown, Check, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type PlanId = "free" | "pro" | "club";

export const PLANS: Array<{
  id: PlanId;
  price: string;
  highlight?: boolean;
  disabled?: boolean;
}> = [
  { id: "free", price: "$0", disabled: true },
  { id: "pro", price: "$8", highlight: true },
  { id: "club", price: "$24" },
];

export function PricingModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto h-12 w-12 grid place-items-center rounded-xl bg-gradient-primary text-primary-foreground mb-2">
            <Crown className="h-6 w-6" />
          </div>
          <DialogTitle className="font-display text-2xl">{t("pricing.modalTitle")}</DialogTitle>
          <DialogDescription>{t("pricing.modalDesc")}</DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-3 gap-3 pt-2">
          {PLANS.map((p) => (
            <PricingCard key={p.id} plan={p} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PricingCard({ plan }: { plan: (typeof PLANS)[number] }) {
  const { t } = useTranslation();
  const features = t(`pricing.plans.${plan.id}.features` as const, { returnObjects: true }) as string[];
  const handleUpgrade = () => {
    toast(t("pricing.stripeComingSoonTitle"), {
      description: t("pricing.stripeComingSoonDesc"),
    });
  };
  if (plan.highlight) {
    return (
      <div className="glass-jade rounded-3xl p-6 flex flex-col gap-4 relative">
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full bg-white/20 border border-white/30 backdrop-blur flex items-center gap-1 z-10">
          <Sparkles className="h-3 w-3" /> {t("pricing.mostPopular")}
        </span>
        <div className="relative z-10">
          <p className="text-xs uppercase tracking-widest opacity-80">{t(`pricing.plans.${plan.id}.name` as const)}</p>
          <p className="font-display text-4xl font-bold glow-text-emerald">
            {plan.price} <span className="text-sm font-normal opacity-80">{t(`pricing.plans.${plan.id}.period` as const)}</span>
          </p>
        </div>
        <ul className="space-y-2 text-sm flex-1 relative z-10">
          {features.map((f) => (
            <li key={f} className="flex gap-2">
              <Check className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <Button
          disabled={plan.disabled}
          onClick={handleUpgrade}
          className="bg-white/15 hover:bg-white/25 text-white border border-white/25 backdrop-blur rounded-2xl relative z-10"
        >
          {t(`pricing.plans.${plan.id}.cta` as const)}
        </Button>
      </div>
    );
  }
  return (
    <Card className={cn("p-5 flex flex-col gap-4 relative rounded-3xl glass-gloss")}>
      <div className="relative z-10">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{t(`pricing.plans.${plan.id}.name` as const)}</p>
        <p className="font-display text-3xl font-bold">
          {plan.price} <span className="text-sm font-normal text-muted-foreground">{t(`pricing.plans.${plan.id}.period` as const)}</span>
        </p>
      </div>
      <ul className="space-y-2 text-sm flex-1 relative z-10">
        {features.map((f) => (
          <li key={f} className="flex gap-2">
            <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Button
        disabled={plan.disabled}
        onClick={handleUpgrade}
        variant="outline"
        className="relative z-10"
      >
        {t(`pricing.plans.${plan.id}.cta` as const)}
      </Button>
    </Card>
  );
}
