import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import type { AudioMode } from "expo-audio";
import type {
  AmbientAudioMode,
  AmbientAudioPlayer,
  AmbientAudioPlayerOptions,
  AmbientAudioSource,
  AmbientAudioStatus,
} from "./ambient-audio.types";

export function useAmbientAudioPlayer(
  source: AmbientAudioSource = null,
  options: AmbientAudioPlayerOptions = {},
): AmbientAudioPlayer {
  return useAudioPlayer(source, options) as AmbientAudioPlayer;
}

export function useAmbientAudioPlayerStatus(player: AmbientAudioPlayer): AmbientAudioStatus {
  const status = useAudioPlayerStatus(player as ReturnType<typeof useAudioPlayer>);

  return {
    currentTime: status?.currentTime ?? 0,
    duration: status?.duration ?? 0,
    playing: status?.playing ?? false,
  };
}

export async function setAmbientAudioModeAsync(mode: AmbientAudioMode): Promise<void> {
  await setAudioModeAsync(mode as Partial<AudioMode>);
}
