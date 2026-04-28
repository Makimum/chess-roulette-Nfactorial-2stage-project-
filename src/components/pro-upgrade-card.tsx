import { Crown, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ProUpgradeCard() {
  const { t } = useTranslation();
  const features = t("pricing.proFeatures", { returnObjects: true }) as string[];
  const handleUpgrade = () => {
    toast(t("pricing.stripeComingSoonTitle"), {
      description: t("pricing.stripeComingSoonDesc"),
    });
  };
  return (
    <div className="glass-jade p-6 rounded-3xl">
      <div className="relative">
        <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full bg-white/15 backdrop-blur border border-white/20 mb-3">
          <Crown className="h-3 w-3" /> {t("pricing.proBadge")}
        </div>
        <h3 className="font-display text-2xl font-bold leading-tight mb-2 glow-text-emerald">
          {t("pricing.proCardTitle")}
        </h3>
        <p className="text-sm opacity-90 mb-4">
          {t("pricing.proCardBlurb")}
        </p>
        <ul className="space-y-1.5 text-sm mb-5">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <Button
          onClick={handleUpgrade}
          className="w-full bg-white/15 hover:bg-white/25 text-white border border-white/25 backdrop-blur rounded-2xl"
        >
          {t("pricing.proCta")}
        </Button>
      </div>
    </div>
  );
}
