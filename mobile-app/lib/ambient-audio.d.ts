import type {
  AmbientAudioMode,
  AmbientAudioPlayer,
  AmbientAudioPlayerOptions,
  AmbientAudioStatus,
  AmbientAudioSource,
} from "./ambient-audio.types";

export function useAmbientAudioPlayer(
  source?: AmbientAudioSource,
  options?: AmbientAudioPlayerOptions,
): AmbientAudioPlayer;

export function useAmbientAudioPlayerStatus(player: AmbientAudioPlayer): AmbientAudioStatus;

export function setAmbientAudioModeAsync(mode: AmbientAudioMode): Promise<void>;
