import { useRef, useState } from "react";
import { Camera, Trash2, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { useAuth } from "@/components/auth-provider";
import { AuthError, resolvePhotoUrl } from "@/lib/auth";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB client-side guard

interface Props {
  initial: string;
}

export function ProfilePhotoUploader({ initial }: Props) {
  const { user, updateProfilePhoto, removeProfilePhoto } = useAuth();
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  const photoSrc = resolvePhotoUrl(user?.photoUrl ?? null);
  const hasPhoto = !!user?.photoUrl;
  const busy = uploading || removing;

  const mapErrorMessage = (e: unknown): string => {
    if (e instanceof AuthError) {
      const msg = e.message.toLowerCase();
      if (e.status === 413 || msg.includes("too large")) return t("profile.photo.tooLarge");
      if (msg.includes("empty")) return t("profile.photo.empty");
      if (msg.includes("jpeg") || msg.includes("png") || msg.includes("webp")) {
        return t("profile.photo.invalidType");
      }
      if (e.status === 503) return t("profile.photo.storageUnavailable");
      return e.message;
    }
    return t("profile.photo.genericError");
  };

  const handlePick = () => {
    if (busy) return;
    inputRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so the same file can be re-selected later.
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error(t("profile.photo.invalidType"));
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(t("profile.photo.tooLarge"));
      return;
    }
    if (file.size === 0) {
      toast.error(t("profile.photo.empty"));
      return;
    }

    setUploading(true);
    try {
      await updateProfilePhoto(file);
      toast.success(t("profile.photo.updated"));
    } catch (err) {
      toast.error(mapErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (busy || !hasPhoto) return;
    setRemoving(true);
    try {
      await removeProfilePhoto();
      toast.success(t("profile.photo.removed"));
    } catch (err) {
      toast.error(mapErrorMessage(err));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handlePick}
        disabled={busy}
        className="relative group rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={t("profile.photo.change")}
      >
        <Avatar className="h-20 w-20 ring-4 ring-primary shadow-glow">
          {photoSrc && <AvatarImage key={photoSrc} src={photoSrc} alt={user?.username ?? ""} />}
          <AvatarFallback className="bg-gradient-primary text-primary-foreground text-2xl font-display">
            {initial}
          </AvatarFallback>
        </Avatar>
        <div className="absolute inset-0 grid place-items-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
          {uploading ? (
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          ) : (
            <Camera className="h-5 w-5 text-white" />
          )}
        </div>
      </button>

      {hasPhoto && (
        <button
          type="button"
          onClick={handleRemove}
          disabled={busy}
          aria-label={t("profile.photo.remove")}
          title={t("profile.photo.remove")}
          className="absolute -bottom-1 -right-1 grid place-items-center h-7 w-7 rounded-full bg-background ring-2 ring-background shadow-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-60 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
        >
          {removing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
