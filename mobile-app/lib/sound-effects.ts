import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioSource } from "expo-audio";
import { Platform } from "react-native";

// Audio Asset Catalog
export const SOUND_ASSETS = {
  // Coin & Reward SFX
  collectTala: require("../assets/audio/BGM/collect tala coins.mp3"),

  // Game SFX & BGM
  muniGamesBgm: require("../assets/audio/BGM/muni games_.mp3"),
  gameOver: require("../assets/audio/BGM/game over.mp3"),
  galaxyFallBgm: require("../assets/audio/BGM/galaxy fall/galaxy fall bgm.mp3"),
  galaxyCrash: require("../assets/audio/BGM/galaxy fall/asteroid_rocket crash.wav"),
  fruitCollected: require("../assets/audio/BGM/catcher/fruit collected.mp3"),
  shellCollected: require("../assets/audio/BGM/catcher/shell collected.wav"),
  matchedMunis: require("../assets/audio/BGM/muni match/matched munis.mp3"),
  correctPair: require("../assets/audio/BGM/gentle pairs/correct pair.mp3"),
  puzzleAccomplished: require("../assets/audio/BGM/puzzle/puzzle accomplished.mp3"),
  correctWord: require("../assets/audio/BGM/unscramble/correct word.mp3"),
  wrongWord: require("../assets/audio/BGM/unscramble/wrong word.wav"),

  // Feature BGM
  wellnessToolsBgm: require("../assets/audio/BGM/wellness tools.mp3"),
  weeklyWrapBgm: require("../assets/audio/BGM/weekly wrap.mp3"),
  wardrobeBgm: require("../assets/audio/BGM/wardrobe_.mp3"),
};

let audioModeConfigured = false;
async function ensureAudioMode() {
  if (audioModeConfigured) return;
  audioModeConfigured = true;
  try {
    if (Platform.OS !== "web") {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
      });
    }
  } catch {
    // Ignore error
  }
}

function createPlayer(source: AudioSource): AudioPlayer {
  return createAudioPlayer(source, { downloadFirst: Platform.OS === "web" });
}

function playAudioElementDirectlyOnWeb(source: any, volume: number, loop: boolean) {
  try {
    const { Asset } = require("expo-asset");
    const asset = typeof source === "number" ? Asset.fromModule(source) : null;
    const uri = asset?.localUri || asset?.uri || (typeof source === "string" ? source : source?.uri);
    if (uri) {
      const audio = new Audio(uri);
      audio.volume = Math.max(0, Math.min(1, volume));
      audio.loop = loop;
      audio.play().catch(() => {});
      return audio;
    }
  } catch {}
  return null;
}

/**
 * Plays a one-shot sound effect (non-looping, self-releasing)
 */
export async function playSoundEffect(source: any, volume = 0.8) {
  if (!source) return;
  try {
    await ensureAudioMode();
    if (Platform.OS === "web" && typeof Audio !== "undefined") {
      const audio = playAudioElementDirectlyOnWeb(source, volume, false);
      if (audio) {
        const cleanup = () => {
          try {
            audio.pause();
            audio.remove();
          } catch {}
        };
        audio.addEventListener("ended", cleanup, { once: true });
        setTimeout(cleanup, 8000);
        return;
      }
    }

    const player = createPlayer(source);
    player.volume = Math.max(0, Math.min(1, volume));
    player.loop = false;
    player.play();

    // Auto cleanup after expected duration or standard timeout
    const cleanupTimer = setTimeout(() => {
      try {
        player.pause();
        player.remove();
      } catch {}
    }, 6000);

    // If playbackStatusUpdate exists, cleanup on finish
    if (typeof (player as any).addListener === "function") {
      const sub = (player as any).addListener("playbackStatusUpdate", (status: any) => {
        if (status?.playbackEnded || (status?.duration > 0 && status?.currentTime >= status?.duration)) {
          clearTimeout(cleanupTimer);
          try {
            sub?.remove?.();
            player.pause();
            player.remove();
          } catch {}
        }
      });
    }
  } catch {
    // Silently handle if audio playback is blocked
  }
}

/**
 * Convenient shortcut for Tala coin collection sound effect
 */
export function playCollectTalaSound(volume = 0.85) {
  void playSoundEffect(SOUND_ASSETS.collectTala, volume);
}

/**
 * Convenient shortcut for Game Over sound effect
 */
export function playGameOverSound(volume = 0.8) {
  void playSoundEffect(SOUND_ASSETS.gameOver, volume);
}

/**
 * Starts a looping background music track and returns a controller
 */
export function startBgmTrack(source: any, volume = 0.25): { stop: () => void; setVolume: (v: number) => void } {
  let player: AudioPlayer | null = null;
  let webAudio: HTMLAudioElement | null = null;
  let isStopped = false;
  // The player is created asynchronously. Remember the latest requested volume so
  // an early setVolume() call (for example, muting right after the screen opens)
  // still applies once playback starts.
  let desiredVolume = Math.max(0, Math.min(1, volume));

  void (async () => {
    try {
      await ensureAudioMode();
      if (isStopped) return;
      if (Platform.OS === "web" && typeof Audio !== "undefined") {
        webAudio = playAudioElementDirectlyOnWeb(source, desiredVolume, true);
        if (webAudio) return;
      }
      player = createPlayer(source);
      player.volume = desiredVolume;
      player.loop = true;
      player.play();
    } catch {
      // Audio playback might be restricted before user interaction on web
    }
  })();

  return {
    stop() {
      isStopped = true;
      if (webAudio) {
        try {
          webAudio.pause();
          webAudio.remove();
        } catch {}
        webAudio = null;
      }
      if (player) {
        try {
          player.pause();
          player.remove();
        } catch {}
        player = null;
      }
    },
    setVolume(v: number) {
      desiredVolume = Math.max(0, Math.min(1, v));
      if (webAudio) {
        webAudio.volume = desiredVolume;
      }
      if (player) {
        player.volume = desiredVolume;
      }
    },
  };
}
