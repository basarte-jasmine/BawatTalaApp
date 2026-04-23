import { Asset } from "expo-asset";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AmbientAudioMode,
  AmbientAudioPlayer,
  AmbientAudioPlayerOptions,
  AmbientAudioSource,
  AmbientAudioStatus,
} from "./ambient-audio.types";

const DEFAULT_STATUS: AmbientAudioStatus = {
  currentTime: 0,
  duration: 0,
  playing: false,
};

function resolveAmbientAudioSource(source: AmbientAudioSource): string | null {
  if (!source) {
    return null;
  }

  if (typeof source === "string") {
    return source;
  }

  if (typeof source === "number") {
    const asset = Asset.fromModule(source);
    return asset.localUri ?? asset.uri;
  }

  if (source.uri) {
    return source.uri;
  }

  if (typeof source.assetId === "number") {
    const asset = Asset.fromModule(source.assetId);
    return asset.localUri ?? asset.uri;
  }

  return null;
}

export function useAmbientAudioPlayer(
  source: AmbientAudioSource = null,
  _options: AmbientAudioPlayerOptions = {},
): AmbientAudioPlayer {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sourceRef = useRef<AmbientAudioSource>(source);
  const [status, setStatus] = useState<AmbientAudioStatus>(DEFAULT_STATUS);
  const statusRef = useRef<AmbientAudioStatus>(DEFAULT_STATUS);

  const updateStatus = () => {
    const audio = audioRef.current;

    if (!audio) {
      statusRef.current = DEFAULT_STATUS;
      setStatus(DEFAULT_STATUS);
      return;
    }

    const nextStatus = {
      currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
      duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      playing: !audio.paused && !audio.ended,
    };

    statusRef.current = nextStatus;
    setStatus(nextStatus);
  };

  const player = useMemo<AmbientAudioPlayer>(() => {
    const id = `web-audio-${Math.random().toString(36).slice(2, 10)}`;

    return {
      id,
      get currentStatus() {
        return statusRef.current;
      },
      get loop() {
        return audioRef.current?.loop ?? false;
      },
      set loop(value: boolean) {
        if (audioRef.current) {
          audioRef.current.loop = value;
        }
      },
      get volume() {
        return audioRef.current?.volume ?? 1;
      },
      set volume(value: number) {
        if (audioRef.current) {
          audioRef.current.volume = Math.max(0, Math.min(1, value));
        }
      },
      play() {
        audioRef.current?.play().catch(() => undefined);
      },
      pause() {
        audioRef.current?.pause();
        updateStatus();
      },
      replace(nextSource: AmbientAudioSource) {
        sourceRef.current = nextSource;
        const audio = audioRef.current;
        const resolvedSource = resolveAmbientAudioSource(nextSource);

        if (!audio) {
          statusRef.current = DEFAULT_STATUS;
          setStatus(DEFAULT_STATUS);
          return;
        }

        audio.pause();
        audio.src = resolvedSource ?? "";
        audio.currentTime = 0;
        audio.load();
        updateStatus();
      },
      seekTo(seconds: number) {
        if (audioRef.current) {
          audioRef.current.currentTime = Math.max(0, seconds);
          updateStatus();
        }

        return Promise.resolve();
      },
    };
  }, []);

  useEffect(() => {
    if (typeof Audio === "undefined") {
      return;
    }

    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;

    const syncStatus = () => updateStatus();

    audio.addEventListener("play", syncStatus);
    audio.addEventListener("pause", syncStatus);
    audio.addEventListener("timeupdate", syncStatus);
    audio.addEventListener("loadedmetadata", syncStatus);
    audio.addEventListener("ended", syncStatus);
    audio.addEventListener("seeked", syncStatus);

    player.replace(sourceRef.current);

    return () => {
      audio.pause();
      audio.removeEventListener("play", syncStatus);
      audio.removeEventListener("pause", syncStatus);
      audio.removeEventListener("timeupdate", syncStatus);
      audio.removeEventListener("loadedmetadata", syncStatus);
      audio.removeEventListener("ended", syncStatus);
      audio.removeEventListener("seeked", syncStatus);
      audio.src = "";
      audioRef.current = null;
    };
  }, [player]);

  useEffect(() => {
    player.replace(source);
  }, [player, source]);

  return player;
}

export function useAmbientAudioPlayerStatus(player: AmbientAudioPlayer): AmbientAudioStatus {
  const [status, setStatus] = useState<AmbientAudioStatus>(player.currentStatus ?? DEFAULT_STATUS);

  useEffect(() => {
    setStatus(player.currentStatus ?? DEFAULT_STATUS);

    const interval = window.setInterval(() => {
      setStatus(player.currentStatus ?? DEFAULT_STATUS);
    }, 250);

    return () => window.clearInterval(interval);
  }, [player]);

  return status;
}

export async function setAmbientAudioModeAsync(_mode: AmbientAudioMode): Promise<void> {
  return Promise.resolve();
}
