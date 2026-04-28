import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Phone,
  PhoneOff,
  Loader2,
  AlertCircle,
} from "lucide-react";
import type {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
} from "agora-rtc-sdk-ng";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getAgoraConfig,
  getAgoraRtcToken,
  getAgoraClientInstanceId,
  type AgoraRtcToken,
} from "@/lib/api";
import { toast } from "sonner";

interface VideoCallPanelProps {
  /** One of these must be provided. */
  roomCode?: string;
  gameId?: number;
  /** Optional title (e.g. "Voice & video"). */
  title?: string;
  /** Hide the entire card if Agora isn't configured. Default: keep it visible but disabled. */
  hideWhenUnavailable?: boolean;
  /** When true and Agora is available, automatically join the call on mount. */
  autoJoin?: boolean;
  /** Visual size of the video tiles. "large" stacks tiles vertically with bigger area. */
  size?: "default" | "large";
  /**
   * Visual layout:
   * - "side-by-side" (default): two equal tiles, good for desktop side-rail.
   * - "pip": opponent fills the area, local user is a small floating overlay
   *   in the corner. Optimised for mobile screens.
   */
  layout?: "side-by-side" | "pip";
}

type CallState =
  | "idle"
  | "checking"
  | "connecting"
  | "in-call"
  | "leaving"
  | "unavailable"
  | "error";

interface RemoteEntry {
  user: IAgoraRTCRemoteUser;
  hasVideo: boolean;
  hasAudio: boolean;
}

export function VideoCallPanel({
  roomCode,
  gameId,
  title,
  hideWhenUnavailable = false,
  autoJoin = false,
  size = "default",
  layout = "side-by-side",
}: VideoCallPanelProps) {
  const { t } = useTranslation();

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const micTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const camTrackRef = useRef<ICameraVideoTrack | null>(null);
  const localContainerRef = useRef<HTMLDivElement | null>(null);
  const remoteContainersRef = useRef<Map<string, HTMLDivElement | null>>(
    new Map(),
  );
  const tokenRef = useRef<AgoraRtcToken | null>(null);
  const renewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localUidRef = useRef<number | string | null>(null);
  const joiningRef = useRef(false);

  const [state, setState] = useState<CallState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [remoteUsers, setRemoteUsers] = useState<RemoteEntry[]>([]);

  // Probe Agora availability once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cfg = await getAgoraConfig();
      if (cancelled) return;
      if ("error" in cfg) {
        setAvailable(false);
        setState("unavailable");
        setErrorMsg(cfg.bucket === "temporarily_unavailable" ? null : cfg.error);
      } else {
        setAvailable(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Attach remote video tracks when refs become available.
  // Audio is played directly on subscribe (no DOM container needed) — we never
  // play the local mic locally, so there's no echo.
  useEffect(() => {
    remoteUsers.forEach((entry) => {
      if (!entry.hasVideo) return;
      const el = remoteContainersRef.current.get(String(entry.user.uid));
      if (el && entry.user.videoTrack && !entry.user.videoTrack.isPlaying) {
        try {
          entry.user.videoTrack.play(el);
        } catch {
          /* ignore */
        }
      }
      // Re-ensure remote audio is playing (safety net for autoplay edge cases).
      if (entry.hasAudio && entry.user.audioTrack && !entry.user.audioTrack.isPlaying) {
        try {
          entry.user.audioTrack.play();
        } catch {
          /* ignore */
        }
      }
    });
  }, [remoteUsers]);

  const cleanupTracks = useCallback(async () => {
    if (renewTimerRef.current) {
      clearTimeout(renewTimerRef.current);
      renewTimerRef.current = null;
    }
    try {
      if (micTrackRef.current) {
        micTrackRef.current.stop();
        micTrackRef.current.close();
        micTrackRef.current = null;
      }
      if (camTrackRef.current) {
        camTrackRef.current.stop();
        camTrackRef.current.close();
        camTrackRef.current = null;
      }
      if (clientRef.current) {
        await clientRef.current.leave();
        clientRef.current.removeAllListeners();
        clientRef.current = null;
      }
    } catch {
      /* ignore */
    }
    remoteContainersRef.current.clear();
    setRemoteUsers([]);
    tokenRef.current = null;
    localUidRef.current = null;
  }, []);

  // Synchronous teardown for page unload — prevents UID_CONFLICT "ghost" sessions
  // when the user reloads quickly. We can't await here, but firing leave() and
  // closing tracks immediately releases the UID on Agora's side fast enough.
  const teardownSync = useCallback(() => {
    try {
      micTrackRef.current?.stop();
      micTrackRef.current?.close();
      micTrackRef.current = null;
    } catch { /* ignore */ }
    try {
      camTrackRef.current?.stop();
      camTrackRef.current?.close();
      camTrackRef.current = null;
    } catch { /* ignore */ }
    try {
      // Fire-and-forget — page is going away, we just need the request sent.
      void clientRef.current?.leave();
      clientRef.current?.removeAllListeners();
      clientRef.current = null;
    } catch { /* ignore */ }
    if (renewTimerRef.current) {
      clearTimeout(renewTimerRef.current);
      renewTimerRef.current = null;
    }
    localUidRef.current = null;
  }, []);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      void cleanupTracks();
    };
  }, [cleanupTracks]);

  // Cleanup on page reload / close / tab hide — guards against UID_CONFLICT.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onUnload = () => teardownSync();
    // pagehide fires more reliably than beforeunload (esp. mobile Safari, bfcache).
    window.addEventListener("pagehide", onUnload);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("pagehide", onUnload);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [teardownSync]);

  const scheduleTokenRenewal = useCallback(
    (token: AgoraRtcToken) => {
      if (renewTimerRef.current) clearTimeout(renewTimerRef.current);
      // Renew 60s before expiry, minimum 30s in the future.
      const renewInMs = Math.max(30_000, (token.expireSeconds - 60) * 1000);
      renewTimerRef.current = setTimeout(async () => {
        if (!clientRef.current) return;
        const res = await getAgoraRtcToken({ roomCode, gameId });
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        try {
          await clientRef.current.renewToken(res.token);
          tokenRef.current = res;
          scheduleTokenRenewal(res);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Token renewal failed");
        }
      }, renewInMs);
    },
    [roomCode, gameId],
  );

  const join = useCallback(async () => {
    if (joiningRef.current) return;
    if (state === "connecting" || state === "in-call") return;
    if (clientRef.current) return;
    if (!roomCode && !gameId) {
      toast.error("No channel target");
      return;
    }
    joiningRef.current = true;
    setErrorMsg(null);
    setState("connecting");
    try {
      const tokenRes = await getAgoraRtcToken({ roomCode, gameId });
      if ("error" in tokenRes) {
        setState("error");
        setErrorMsg(tokenRes.error);
        toast.error(tokenRes.error);
        return;
      }
      tokenRef.current = tokenRes;

      console.log("[agora] TOKEN", {
        roomCode,
        gameId,
        channelName: tokenRes.channelName,
        uid: tokenRes.uid,
        clientInstanceId: getAgoraClientInstanceId(),
      });

      // Dynamically import to keep the SDK out of the initial bundle.
      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      client.on("user-published", async (user, mediaType) => {
        const localUid = localUidRef.current;
        const same = user.uid === localUid;
        console.log("[agora] REMOTE PUBLISHED", {
          remoteUid: user.uid,
          localUid,
          mediaType,
          same,
        });
        if (same) {
          console.warn(
            "[agora] SELF-ECHO blocked — backend returned same UID for both peers",
            { uid: user.uid },
          );
          return;
        }
        await client.subscribe(user, mediaType);
        if (mediaType === "audio") {
          user.audioTrack?.play();
        }
        setRemoteUsers((prev) => {
          const existing = prev.find((p) => p.user.uid === user.uid);
          const entry: RemoteEntry = {
            user,
            hasVideo:
              mediaType === "video" ? true : (existing?.hasVideo ?? false),
            hasAudio:
              mediaType === "audio" ? true : (existing?.hasAudio ?? false),
          };
          if (existing) {
            return prev.map((p) => (p.user.uid === user.uid ? entry : p));
          }
          return [...prev, entry];
        });
      });

      client.on("user-unpublished", (user, mediaType) => {
        if (user.uid === localUidRef.current) return;
        setRemoteUsers((prev) =>
          prev.map((p) =>
            p.user.uid === user.uid
              ? {
                  ...p,
                  hasVideo: mediaType === "video" ? false : p.hasVideo,
                  hasAudio: mediaType === "audio" ? false : p.hasAudio,
                }
              : p,
          ),
        );
      });

      client.on("user-left", (user) => {
        setRemoteUsers((prev) => prev.filter((p) => p.user.uid !== user.uid));
        remoteContainersRef.current.delete(String(user.uid));
      });

      client.on("token-privilege-will-expire", async () => {
        const res = await getAgoraRtcToken({ roomCode, gameId });
        if ("error" in res) return;
        try {
          await client.renewToken(res.token);
          tokenRef.current = res;
          scheduleTokenRenewal(res);
        } catch {
          /* ignore */
        }
      });

      const joinedUid = await client.join(
        tokenRes.appId,
        tokenRes.channelName,
        tokenRes.token,
        tokenRes.uid ?? null,
      );
      localUidRef.current = (joinedUid ?? client.uid ?? tokenRes.uid) as
        | number
        | string
        | null;
      console.log("[agora] JOINED", { localUid: localUidRef.current });

      // Create and publish local tracks.
      const [micTrack, camTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
        undefined,
        { encoderConfig: "480p_1" },
      );
      micTrackRef.current = micTrack;
      camTrackRef.current = camTrack;
      if (localContainerRef.current) {
        camTrack.play(localContainerRef.current);
      }
      await client.publish([micTrack, camTrack]);
      setMicOn(true);
      setCamOn(true);
      setState("in-call");
      scheduleTokenRenewal(tokenRes);
      joiningRef.current = false;
    } catch (e) {
      setState("error");
      const raw = e instanceof Error ? e.message : "Could not start call";
      const msg = /UID_CONFLICT/i.test(raw)
        ? "Голосовой чат уже подключается в другой вкладке или ещё не освободил сессию. Подождите несколько секунд и попробуйте снова."
        : raw;
      setErrorMsg(msg);
      toast.error(msg);
      await cleanupTracks();
      joiningRef.current = false;
    }
  }, [state, roomCode, gameId, scheduleTokenRenewal, cleanupTracks]);

  const leave = useCallback(async () => {
    setState("leaving");
    await cleanupTracks();
    setState("idle");
  }, [cleanupTracks]);

  const toggleMic = useCallback(async () => {
    if (!micTrackRef.current) return;
    const next = !micOn;
    await micTrackRef.current.setEnabled(next);
    setMicOn(next);
  }, [micOn]);

  const toggleCam = useCallback(async () => {
    if (!camTrackRef.current) return;
    const next = !camOn;
    await camTrackRef.current.setEnabled(next);
    setCamOn(next);
  }, [camOn]);

  // Auto-join once Agora is confirmed available and a target channel exists.
  const autoJoinTriedRef = useRef(false);
  useEffect(() => {
    if (!autoJoin) return;
    if (autoJoinTriedRef.current) return;
    if (available !== true) return;
    if (!roomCode && !gameId) return;
    if (state !== "idle") return;
    autoJoinTriedRef.current = true;
    void join();
  }, [autoJoin, available, roomCode, gameId, state, join]);

  if (hideWhenUnavailable && available === false) return null;

  const inCall = state === "in-call";
  const connecting = state === "connecting";

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm">
          {title ?? t("call.title")}
        </h3>
        {inCall ? (
          <Badge variant="default" className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
            {t("call.live")}
          </Badge>
        ) : available === false ? (
          <Badge variant="secondary">{t("call.unavailable")}</Badge>
        ) : (
          <Badge variant="outline">{t("call.idle")}</Badge>
        )}
      </div>

      {/* Video stage */}
      {layout === "pip" ? (
        <div className="relative w-full aspect-[3/4] sm:aspect-video rounded-lg overflow-hidden bg-muted border border-border">
          {/* Remote (opponent) — fills the area */}
          {remoteUsers.length === 0 ? (
            <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground text-center px-3">
              {inCall ? t("call.waitingForPeer") : t("call.notConnected")}
            </div>
          ) : (
            <div
              ref={(el) => {
                const u = remoteUsers[0];
                if (u) remoteContainersRef.current.set(String(u.user.uid), el);
              }}
              className="absolute inset-0 [&_video]:object-cover"
            />
          )}
          <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wider bg-background/70 backdrop-blur px-1.5 py-0.5 rounded">
            {t("call.opponent")}
          </span>
          {remoteUsers[0] && (
            <div className="absolute top-2 right-2 flex items-center gap-1">
              <span className="bg-background/70 backdrop-blur p-1 rounded" title={remoteUsers[0].hasAudio ? "Микрофон включён" : "Микрофон выключен"}>
                {remoteUsers[0].hasAudio ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3 text-muted-foreground" />}
              </span>
              <span className="bg-background/70 backdrop-blur p-1 rounded" title={remoteUsers[0].hasVideo ? "Камера включена" : "Камера выключена"}>
                {remoteUsers[0].hasVideo ? <Video className="h-3 w-3" /> : <VideoOff className="h-3 w-3 text-muted-foreground" />}
              </span>
            </div>
          )}

          {/* Local (you) — floating PiP in bottom-right corner */}
          <div className="absolute bottom-3 right-3 w-24 h-32 sm:w-32 sm:h-24 rounded-md overflow-hidden ring-2 ring-background shadow-lg bg-muted z-10">
            <div
              ref={localContainerRef}
              className="absolute inset-0 [&_video]:object-cover"
            />
            {!camOn && (
              <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground bg-muted">
                <VideoOff className="h-4 w-4" />
              </div>
            )}
            <span className="absolute bottom-0.5 left-0.5 text-[9px] uppercase tracking-wider bg-background/70 backdrop-blur px-1 rounded">
              {t("call.you")}
            </span>
          </div>
        </div>
      ) : (
        <div
          className={
            size === "large"
              ? "grid grid-cols-1 sm:grid-cols-2 gap-3"
              : "grid grid-cols-2 gap-2"
          }
        >
          <div
            className={`relative ${size === "large" ? "aspect-[4/3] sm:aspect-video" : "aspect-video"} rounded-md overflow-hidden bg-muted border border-border`}
          >
            <div
              ref={localContainerRef}
              className="absolute inset-0 [&_video]:object-cover"
            />
            {!camOn && (
              <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
                <VideoOff className="h-5 w-5" />
              </div>
            )}
            <span className="absolute bottom-1 left-1 text-[10px] uppercase tracking-wider bg-background/70 backdrop-blur px-1.5 py-0.5 rounded">
              {t("call.you")}
            </span>
          </div>
          <div
            className={`relative ${size === "large" ? "aspect-[4/3] sm:aspect-video" : "aspect-video"} rounded-md overflow-hidden bg-muted border border-border`}
          >
            {remoteUsers.length === 0 ? (
              <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground text-center px-2">
                {inCall ? t("call.waitingForPeer") : t("call.notConnected")}
              </div>
            ) : (
              <div
                ref={(el) => {
                  const u = remoteUsers[0];
                  if (u) remoteContainersRef.current.set(String(u.user.uid), el);
                }}
                className="absolute inset-0 [&_video]:object-cover"
              />
            )}
            <span className="absolute bottom-1 left-1 text-[10px] uppercase tracking-wider bg-background/70 backdrop-blur px-1.5 py-0.5 rounded">
              {t("call.opponent")}
            </span>
            {remoteUsers[0] && (
              <div className="absolute top-1 right-1 flex items-center gap-1">
                <span className="bg-background/70 backdrop-blur p-1 rounded">
                  {remoteUsers[0].hasAudio ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3 text-muted-foreground" />}
                </span>
                <span className="bg-background/70 backdrop-blur p-1 rounded">
                  {remoteUsers[0].hasVideo ? <Video className="h-3 w-3" /> : <VideoOff className="h-3 w-3 text-muted-foreground" />}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {!inCall ? (
          <Button
            size="sm"
            onClick={join}
            disabled={connecting || available === false || !!(!roomCode && !gameId)}
            className="bg-gradient-primary text-primary-foreground"
          >
            {connecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Phone className="h-4 w-4" />
            )}
            {connecting ? t("call.connecting") : t("call.join")}
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              variant={micOn ? "outline" : "secondary"}
              onClick={toggleMic}
              aria-pressed={!micOn}
              title={micOn ? t("call.muteMic") : t("call.unmuteMic")}
            >
              {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              <span className="hidden sm:inline">
                {micOn ? t("call.micOn") : t("call.micOff")}
              </span>
            </Button>
            <Button
              size="sm"
              variant={camOn ? "outline" : "secondary"}
              onClick={toggleCam}
              aria-pressed={!camOn}
              title={camOn ? t("call.stopCam") : t("call.startCam")}
            >
              {camOn ? (
                <Video className="h-4 w-4" />
              ) : (
                <VideoOff className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {camOn ? t("call.camOn") : t("call.camOff")}
              </span>
            </Button>
            <Button size="sm" variant="destructive" onClick={leave}>
              <PhoneOff className="h-4 w-4" />
              <span className="hidden sm:inline">{t("call.leave")}</span>
            </Button>
          </>
        )}
      </div>

      {available === false && (
        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          {t("call.unavailableHint")}
        </p>
      )}
      {errorMsg && state === "error" && (
        <p className="text-xs text-destructive flex items-start gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          {errorMsg}
        </p>
      )}
    </Card>
  );
}
