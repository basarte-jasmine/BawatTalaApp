export type AmbientAudioSource =
  | string
  | number
  | null
  | {
      uri?: string;
      assetId?: number;
      headers?: Record<string, string>;
    };

export type AmbientAudioPlayerOptions = {
  updateInterval?: number;
};

export type AmbientAudioStatus = {
  currentTime: number;
  duration: number;
  playing: boolean;
};

export type AmbientAudioMode = {
  interruptionMode?: "mixWithOthers" | "duckOthers" | "auto" | "doNotMix";
  playsInSilentMode?: boolean;
};

export type AmbientAudioPlayer = {
  currentStatus: AmbientAudioStatus;
  id: number | string;
  loop: boolean;
  pause: () => void;
  play: () => void;
  replace: (source: AmbientAudioSource) => void;
  seekTo: (seconds: number) => Promise<void> | void;
  volume: number;
};
