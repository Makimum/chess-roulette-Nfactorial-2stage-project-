import { useTranslation } from "react-i18next";
import { Video, VideoOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface VideoConsentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAllow: () => void;
  onDecline: () => void;
}

export function VideoConsentDialog({
  open,
  onOpenChange,
  onAllow,
  onDecline,
}: VideoConsentDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="grid place-items-center h-12 w-12 rounded-xl bg-gradient-primary text-primary-foreground mb-2">
            <Video className="h-5 w-5" />
          </div>
          <DialogTitle>{t("call.consentTitle")}</DialogTitle>
          <DialogDescription>{t("call.consentDesc")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="outline" onClick={onDecline}>
            <VideoOff className="h-4 w-4" />
            {t("call.consentDecline")}
          </Button>
          <Button
            onClick={onAllow}
            className="bg-gradient-primary text-primary-foreground"
          >
            <Video className="h-4 w-4" />
            {t("call.consentAllow")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
