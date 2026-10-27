import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type IdCardCameraModalProps = {
  visible: boolean;
  onClose: () => void;
  onCapture: (data: { base64: string; uri: string; width?: number; height?: number }) => void;
};

export function IdCardCameraModal({ visible, onClose, onCapture }: IdCardCameraModalProps) {
  const [cameraError, setCameraError] = useState("");
  const [isAligned, setIsAligned] = useState(false);
  const [alignmentMessage, setAlignmentMessage] = useState("Align ID inside frame");
  const [isCapturing, setIsCapturing] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyzeIntervalRef = useRef<any>(null);
  const videoContainerRef = useRef<any>(null);
  const hiddenInputRef = useRef<any>(null);

  const stopCameraStream = useCallback(() => {
    if (analyzeIntervalRef.current) {
      clearInterval(analyzeIntervalRef.current);
      analyzeIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
      } catch {}
      videoRef.current = null;
    }
  }, []);

  const handleNativeCamera = useCallback(async () => {
    try {
      const ImagePicker = await import("expo-image-picker");
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setCameraError("Camera permission was denied. Please allow camera access in your settings.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [16, 10],
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || !result.assets || !result.assets[0]) {
        onClose();
        return;
      }

      const asset = result.assets[0];
      if (asset.base64) {
        onCapture({
          base64: asset.base64,
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
        });
      } else {
        onClose();
      }
    } catch (err: any) {
      setCameraError(err?.message || "Failed to open camera.");
    }
  }, [onCapture, onClose]);

  const startWebCamera = useCallback(async () => {
    stopCameraStream();
    setCameraError("");
    setIsAligned(false);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera is not supported on this browser or connection.");
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const container = videoContainerRef.current;
      let video = videoRef.current;
      if (!video && container && typeof document !== "undefined") {
        video = document.createElement("video");
        video.setAttribute("playsinline", "true");
        video.setAttribute("webkit-playsinline", "true");
        video.setAttribute("autoplay", "true");
        video.muted = true;
        video.style.width = "100%";
        video.style.height = "100%";
        video.style.objectFit = "cover";
        video.style.borderRadius = "12px";
        container.appendChild(video);
        videoRef.current = video;
      }

      if (video) {
        video.srcObject = stream;
        video.play().catch(() => {});
      }

      if (!canvasRef.current && typeof document !== "undefined") {
        const offscreenCanvas = document.createElement("canvas");
        offscreenCanvas.width = 160;
        offscreenCanvas.height = 100;
        canvasRef.current = offscreenCanvas;
      }

      let steadyFrames = 0;
      analyzeIntervalRef.current = setInterval(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2) return;

        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;
          const w = canvas.width;
          const h = canvas.height;

          let totalLuma = 0;
          const sampleStep = 3;
          let sampleCount = 0;
          for (let i = 0; i < data.length; i += 4 * sampleStep) {
            totalLuma += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            sampleCount++;
          }
          const avgLuma = sampleCount > 0 ? totalLuma / sampleCount : 0;

          if (avgLuma < 30) {
            steadyFrames = 0;
            setIsAligned(false);
            setAlignmentMessage("Too dark - Move to better lighting");
            return;
          }
          if (avgLuma > 235) {
            steadyFrames = 0;
            setIsAligned(false);
            setAlignmentMessage("Too bright - Avoid glare on ID");
            return;
          }

          let lapSum = 0;
          let lapSqSum = 0;
          let lapCount = 0;
          const startX = Math.floor(w * 0.15);
          const endX = Math.floor(w * 0.85);
          const startY = Math.floor(h * 0.18);
          const endY = Math.floor(h * 0.82);

          for (let y = startY; y < endY; y += 3) {
            for (let x = startX; x < endX; x += 3) {
              const idx = (y * w + x) * 4;
              const center = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
              const upIdx = ((y - 1) * w + x) * 4;
              const downIdx = ((y + 1) * w + x) * 4;
              const leftIdx = (y * w + (x - 1)) * 4;
              const rightIdx = (y * w + (x + 1)) * 4;
              const lUp = 0.299 * data[upIdx] + 0.587 * data[upIdx + 1] + 0.114 * data[upIdx + 2];
              const lDown = 0.299 * data[downIdx] + 0.587 * data[downIdx + 1] + 0.114 * data[downIdx + 2];
              const lLeft = 0.299 * data[leftIdx] + 0.587 * data[leftIdx + 1] + 0.114 * data[leftIdx + 2];
              const lRight = 0.299 * data[rightIdx] + 0.587 * data[rightIdx + 1] + 0.114 * data[rightIdx + 2];
              const lap = Math.abs(4 * center - lUp - lDown - lLeft - lRight);
              lapSum += lap;
              lapSqSum += lap * lap;
              lapCount++;
            }
          }

          const meanLap = lapCount > 0 ? lapSum / lapCount : 0;
          const varLap = lapCount > 0 ? (lapSqSum / lapCount) - (meanLap * meanLap) : 0;

          if (varLap < 20) {
            steadyFrames = 0;
            setIsAligned(false);
            setAlignmentMessage("Image is blurry - Hold steady and focus");
            return;
          }

          let edgeCount = 0;
          for (let x = startX; x < endX; x += 4) {
            const topY1 = (startY * w + x) * 4;
            const topY0 = (Math.max(0, startY - 3) * w + x) * 4;
            if (Math.abs(data[topY1] - data[topY0]) > 22) edgeCount++;
            const btmY1 = (endY * w + x) * 4;
            const btmY0 = (Math.min(h - 1, endY + 3) * w + x) * 4;
            if (Math.abs(data[btmY1] - data[btmY0]) > 22) edgeCount++;
          }

          const isCardFit = edgeCount >= 8;
          if (!isCardFit) {
            steadyFrames = 0;
            setIsAligned(false);
            setAlignmentMessage("Fit ID edges inside the frame");
            return;
          }

          steadyFrames++;
          if (steadyFrames >= 2) {
            setIsAligned(true);
            setAlignmentMessage("ID Aligned - Ready to capture");
          }
        } catch {
          setIsAligned(false);
          setAlignmentMessage("Align ID inside frame");
        }
      }, 150);
    } catch (err: any) {
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setCameraError("Camera permission denied. Please allow camera permissions in your browser.");
      } else {
        setCameraError(err?.message || "Could not access camera. Try uploading from files.");
      }
    }
  }, [facingMode, stopCameraStream]);

  useEffect(() => {
    if (!visible) {
      stopCameraStream();
      return;
    }

    if (Platform.OS === "web") {
      void startWebCamera();
    } else {
      void handleNativeCamera();
    }

    return () => {
      stopCameraStream();
    };
  }, [facingMode, handleNativeCamera, startWebCamera, stopCameraStream, visible]);

  const capturePhoto = async () => {
    if (isCapturing) return;
    setIsCapturing(true);

    try {
      const video = videoRef.current;
      if (!video || !video.videoWidth) {
        if (Platform.OS === "web" && hiddenInputRef.current) {
          hiddenInputRef.current.click();
          setIsCapturing(false);
          return;
        }
        throw new Error("Camera feed is not ready.");
      }

      const vidW = video.videoWidth || 1280;
      const vidH = video.videoHeight || 720;

      // Crop to the central guide frame (85% width, aspect ratio 1.58)
      const cropWidth = Math.round(vidW * 0.85);
      const cropHeight = Math.min(vidH, Math.round(cropWidth / 1.58));
      const cropX = Math.round((vidW - cropWidth) / 2);
      const cropY = Math.round((vidH - cropHeight) / 2);

      const snapCanvas = document.createElement("canvas");
      snapCanvas.width = cropWidth;
      snapCanvas.height = cropHeight;
      const ctx = snapCanvas.getContext("2d");
      if (!ctx) throw new Error("Could not prepare image canvas.");

      ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      const dataUrl = snapCanvas.toDataURL("image/jpeg", 0.85);
      const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, "");

      stopCameraStream();
      onCapture({
        base64,
        uri: dataUrl,
        width: snapCanvas.width,
        height: snapCanvas.height,
      });
    } catch (err: any) {
      setCameraError(err?.message || "Failed to capture ID photo.");
    } finally {
      setIsCapturing(false);
    }
  };

  const handleFileCaptureInput = (e: any) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.replace(/^data:image\/[a-zA-Z]+;base64,/, "");
      stopCameraStream();
      onCapture({
        base64,
        uri: dataUrl,
      });
    };
    reader.readAsDataURL(file);
  };

  const switchCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Ionicons name="scan-outline" size={22} color="#4F7A35" />
              <Text style={styles.headerTitle}>Scan School ID</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
              <Ionicons name="close" size={24} color="#334155" />
            </Pressable>
          </View>

          <View
            style={[
              styles.statusBadge,
              isAligned ? styles.statusBadgeAligned : styles.statusBadgeUnaligned,
            ]}
          >
            <View
              style={[
                styles.statusDot,
                isAligned ? styles.statusDotAligned : styles.statusDotUnaligned,
              ]}
            />
            <Text
              style={[
                styles.statusText,
                isAligned ? styles.statusTextAligned : styles.statusTextUnaligned,
              ]}
            >
              {alignmentMessage}
            </Text>
          </View>

          <View style={styles.viewfinderWrap}>
            {Platform.OS === "web" ? (
              <View
                style={styles.webVideoContainer}
                ref={(el: any) => {
                  videoContainerRef.current = el;
                  if (el && typeof document !== "undefined") {
                    let video = videoRef.current;
                    if (!video) {
                      const existing = el.querySelector("video");
                      if (existing) {
                        video = existing;
                      } else {
                        video = document.createElement("video");
                        video.setAttribute("playsinline", "true");
                        video.setAttribute("webkit-playsinline", "true");
                        video.setAttribute("autoplay", "true");
                        video.muted = true;
                        video.style.width = "100%";
                        video.style.height = "100%";
                        video.style.objectFit = "cover";
                        video.style.borderRadius = "12px";
                        el.appendChild(video);
                      }
                      videoRef.current = video;
                    }
                    if (streamRef.current && video && video.srcObject !== streamRef.current) {
                      video.srcObject = streamRef.current;
                      video.play().catch(() => {});
                    }
                  }
                }}
              />
            ) : (
              <View style={styles.nativePlaceholder}>
                <ActivityIndicator size="large" color="#4F7A35" />
                <Text style={styles.nativePlaceholderText}>Opening camera...</Text>
              </View>
            )}

            <View
              style={[
                styles.cardFrame,
                isAligned ? styles.cardFrameAligned : styles.cardFrameUnaligned,
              ]}
              pointerEvents="none"
            >
              <View
                style={[
                  styles.corner,
                  styles.cornerTL,
                  isAligned ? styles.cornerAligned : styles.cornerUnaligned,
                ]}
              />
              <View
                style={[
                  styles.corner,
                  styles.cornerTR,
                  isAligned ? styles.cornerAligned : styles.cornerUnaligned,
                ]}
              />
              <View
                style={[
                  styles.corner,
                  styles.cornerBL,
                  isAligned ? styles.cornerAligned : styles.cornerUnaligned,
                ]}
              />
              <View
                style={[
                  styles.corner,
                  styles.cornerBR,
                  isAligned ? styles.cornerAligned : styles.cornerUnaligned,
                ]}
              />
            </View>
          </View>

          {Platform.OS === "web" ? (
            <input
              type="file"
              ref={hiddenInputRef}
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={handleFileCaptureInput}
            />
          ) : null}

          {cameraError ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#DC2626" />
              <Text style={styles.errorText}>{cameraError}</Text>
            </View>
          ) : (
            <Text style={styles.instructions}>
              Make sure your photo, student number, and name are clear and glare-free.
            </Text>
          )}

          <View style={styles.actionsRow}>
            {Platform.OS === "web" && (
              <Pressable style={styles.secondaryActionBtn} onPress={switchCamera} disabled={isCapturing}>
                <Ionicons name="camera-reverse-outline" size={22} color="#334155" />
              </Pressable>
            )}

            <Pressable
              style={[
                styles.shutterBtn,
                isAligned ? styles.shutterBtnAligned : styles.shutterBtnUnaligned,
                isCapturing && styles.shutterBtnDisabled,
              ]}
              onPress={capturePhoto}
              disabled={isCapturing}
            >
              {isCapturing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <View
                  style={[
                    styles.shutterInner,
                    isAligned ? styles.shutterInnerAligned : styles.shutterInnerUnaligned,
                  ]}
                />
              )}
            </Pressable>

            <Pressable style={styles.secondaryActionBtn} onPress={onClose} disabled={isCapturing}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.75)", justifyContent: "center", alignItems: "center", padding: 16 },
  container: { width: "100%", maxWidth: 420, backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 17, fontFamily: "Outfit-Bold", color: "#1E293B" },
  closeBtn: { padding: 4 },
  statusBadge: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, marginBottom: 12, borderWidth: 1 },
  statusBadgeAligned: { backgroundColor: "#F0FDF4", borderColor: "#86EFAC" },
  statusBadgeUnaligned: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusDotAligned: { backgroundColor: "#16A34A" },
  statusDotUnaligned: { backgroundColor: "#DC2626" },
  statusText: { fontSize: 12, fontWeight: "600" },
  statusTextAligned: { color: "#15803D" },
  statusTextUnaligned: { color: "#B91C1C" },
  viewfinderWrap: { width: "100%", height: 250, backgroundColor: "#0F172A", borderRadius: 14, overflow: "hidden", position: "relative", justifyContent: "center", alignItems: "center" },
  webVideoContainer: { width: "100%", height: "100%" },
  nativePlaceholder: { justifyContent: "center", alignItems: "center", gap: 10 },
  nativePlaceholderText: { color: "#CBD5E1", fontSize: 13 },
  cardFrame: { position: "absolute", width: "82%", aspectRatio: 1.58, borderRadius: 10, borderWidth: 2, borderStyle: "dashed", justifyContent: "center", alignItems: "center" },
  cardFrameAligned: { borderColor: "#22C55E", backgroundColor: "rgba(34, 197, 94, 0.08)" },
  cardFrameUnaligned: { borderColor: "#EF4444", backgroundColor: "rgba(239, 68, 68, 0.06)" },
  corner: { position: "absolute", width: 18, height: 18, borderWidth: 3 },
  cornerAligned: { borderColor: "#22C55E" },
  cornerUnaligned: { borderColor: "#EF4444" },
  cornerTL: { top: -2, left: -2, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  cornerTR: { top: -2, right: -2, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  cornerBL: { bottom: -2, left: -2, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: -2, right: -2, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
  instructions: { textAlign: "center", fontSize: 11, color: "#64748B", marginTop: 10, lineHeight: 16 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FEF2F2", padding: 8, borderRadius: 8, marginTop: 8 },
  errorText: { flex: 1, fontSize: 11, color: "#DC2626" },
  actionsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14, paddingHorizontal: 12 },
  secondaryActionBtn: { minWidth: 60, height: 40, justifyContent: "center", alignItems: "center" },
  cancelText: { color: "#64748B", fontSize: 13, fontWeight: "600" },
  shutterBtn: { width: 64, height: 64, borderRadius: 32, borderWidth: 4, justifyContent: "center", alignItems: "center", backgroundColor: "#FFFFFF" },
  shutterBtnAligned: { borderColor: "#22C55E" },
  shutterBtnUnaligned: { borderColor: "#EF4444" },
  shutterBtnDisabled: { opacity: 0.6 },
  shutterInner: { width: 48, height: 48, borderRadius: 24 },
  shutterInnerAligned: { backgroundColor: "#22C55E" },
  shutterInnerUnaligned: { backgroundColor: "#EF4444" },
});
