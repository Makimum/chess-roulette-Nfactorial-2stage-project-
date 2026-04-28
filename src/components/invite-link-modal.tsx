import { useState } from "react";
import { Copy, Check, Share2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface InviteLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: string;
}

export function InviteLinkModal({ open, onOpenChange, code }: InviteLinkModalProps) {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();
  const link = typeof window !== "undefined" ? `${window.location.origin}/play/friend?code=${code}` : `/play/friend?code=${code}`;

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            {t("play.inviteFriend")}
          </DialogTitle>
          <DialogDescription>{t("play.inviteDesc")}</DialogDescription>
        </DialogHeader>

        <div className="rounded-xl bg-gradient-subtle p-6 text-center border border-border">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{t("play.roomCodeLabel")}</p>
          <p className="font-display font-bold text-4xl tracking-[0.3em] text-gradient">{code}</p>
        </div>

        <div className="flex gap-2">
          <Input readOnly value={link} className="font-mono text-xs" />
          <Button onClick={copy} variant={copied ? "secondary" : "default"} className="shrink-0">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
