import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  fetchStudentReferral,
  redeemStudentReferralCode,
  type StudentReferral,
} from "../lib/backend-api";
import { useAuthSession } from "../lib/auth-session";

const TALA_IMAGE = require("../assets/images/Tala_Star.png");
const SIGNUP_URL = "https://bawat-tala-mobile.vercel.app/";
const REFERRAL_CODE_LENGTH = 9;

function normalizeReferralCode(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, REFERRAL_CODE_LENGTH);
}

export default function ReferralScreen() {
  const { user } = useAuthSession();
  const [referral, setReferral] = useState<StudentReferral | null>(null);
  const [loading, setLoading] = useState(true);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemError, setRedeemError] = useState("");
  const [redeemMessage, setRedeemMessage] = useState("");
  const [redeemSaving, setRedeemSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareMessage = useMemo(() => {
    const code = referral?.referralCode || "YOUR_CODE";
    return `Hey! Start your wellness journey with Bawat Tala. Use my referral code ${code} when you sign up to get 100 Tala instantly!\n\nSign up here : ${SIGNUP_URL}`;
  }, [referral?.referralCode]);

  useEffect(() => {
    if (!user?.studentNumber) {
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);
    void fetchStudentReferral(user.studentNumber)
      .then((result) => {
        if (!mounted) return;
        if (!result.ok || !result.referral) {
          Alert.alert("Referral Unavailable", result.message || "Unable to load your referral code.");
          return;
        }
        setReferral(result.referral);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [user?.studentNumber]);

  const handleCopyCode = async () => {
    if (!referral?.referralCode) return;
    await Clipboard.setStringAsync(referral.referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const handleShare = async () => {
    if (!referral?.referralCode) return;
    await Share.share({
      message: shareMessage,
      title: "Invite a Friend",
    });
  };

  const handleRedeem = async () => {
    if (!user?.studentNumber) {
      setRedeemError("Student session is missing.");
      return;
    }

    const code = normalizeReferralCode(redeemCode);
    if (code.length !== REFERRAL_CODE_LENGTH) {
      setRedeemError("Enter a valid 9-character referral code.");
      return;
    }

    if (referral?.referralCode === code) {
      setRedeemError("You can't use your own referral code.");
      return;
    }

    setRedeemError("");
    setRedeemMessage("");
    setRedeemSaving(true);
    const result = await redeemStudentReferralCode(user.studentNumber, code);
    setRedeemSaving(false);

    if (!result.ok || !result.referral) {
      setRedeemError(result.message || "Unable to redeem this code.");
      if (result.referral) setReferral(result.referral);
      return;
    }

    setReferral(result.referral);
    setRedeemCode("");
    setRedeemMessage(result.message || `Success! You claimed ${result.rewardTala ?? 100} Tala.`);
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/profile");
  };

  const hasRedeemed = Boolean(referral?.hasRedeemed);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} accessibilityLabel="Go back" onPress={handleBack}>
          <Ionicons name="chevron-back" size={30} color="#3D3F43" />
        </Pressable>
        <Text style={styles.topTitle}>Invite a Friend</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <Image source={TALA_IMAGE} style={styles.heroIcon} resizeMode="contain" />
          </View>
          <Text style={styles.heroTitle}>Invite a Friend</Text>
          <Text style={styles.heroSubtitle}>Earn 150 Tala for every friend who joins!</Text>
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color="#70C943" />
            <Text style={styles.loadingText}>Loading your referral code...</Text>
          </View>
        ) : (
          <>
            <View style={styles.codeCard}>
              <View style={styles.codeHeader}>
                <Text style={styles.cardEyebrow}>YOUR REFERRAL CODE</Text>
                <View style={styles.rewardPill}>
                  <Image source={TALA_IMAGE} style={styles.rewardIcon} resizeMode="contain" />
                  <Text style={styles.rewardText}>+150</Text>
                </View>
              </View>

              <View style={styles.codeRow}>
                <Text style={styles.codeText}>{referral?.referralCode || "---------"} </Text>
                <Pressable style={styles.copyButton} accessibilityLabel="Copy referral code" onPress={handleCopyCode}>
                  <Ionicons name={copied ? "checkmark" : "copy-outline"} size={20} color="#31515F" />
                </Pressable>
              </View>
            </View>

            <Pressable
              style={[styles.primaryButton, !referral?.referralCode && styles.buttonDisabled]}
              disabled={!referral?.referralCode}
              onPress={() => void handleShare()}
            >
              <Ionicons name="share-social-outline" size={20} color="#FFFFFF" />
              <Text style={styles.primaryText}>Refer a Friend</Text>
            </Pressable>

            <View style={styles.redeemCard}>
              <View style={styles.redeemHeader}>
                <View style={styles.redeemIconWrap}>
                  <Image source={TALA_IMAGE} style={styles.redeemIcon} resizeMode="contain" />
                </View>
                <View style={styles.redeemHeaderText}>
                  <Text style={styles.cardTitle}>Claim Friend Reward</Text>
                  <Text style={styles.helperText}>Enter a code to claim 100 Tala.</Text>
                </View>
              </View>

              {hasRedeemed ? (
                <View style={styles.successBox}>
                  <Ionicons name="checkmark-circle" size={24} color="#5A9F33" />
                  <View style={styles.successCopy}>
                    <Text style={styles.successTitle}>Success</Text>
                    <Text style={styles.successText}>
                      You already claimed your friend reward. Referral codes can only be redeemed once per account.
                    </Text>
                  </View>
                </View>
              ) : (
                <>
                  <TextInput
                    value={redeemCode}
                    onChangeText={(value) => {
                      setRedeemCode(normalizeReferralCode(value));
                      if (redeemError) setRedeemError("");
                      if (redeemMessage) setRedeemMessage("");
                    }}
                    autoCapitalize="characters"
                    maxLength={REFERRAL_CODE_LENGTH}
                    placeholder="Enter friend's code"
                    placeholderTextColor="#97A1AA"
                    style={styles.textInput}
                  />
                  {!!redeemError && <Text style={styles.errorText}>{redeemError}</Text>}
                  {!!redeemMessage && <Text style={styles.successInline}>{redeemMessage}</Text>}
                  <Pressable
                    style={[
                      styles.secondaryActionButton,
                      (redeemSaving || redeemCode.length !== REFERRAL_CODE_LENGTH) && styles.buttonDisabled,
                    ]}
                    disabled={redeemSaving || redeemCode.length !== REFERRAL_CODE_LENGTH}
                    onPress={() => void handleRedeem()}
                  >
                    <Text style={styles.secondaryActionText}>{redeemSaving ? "Claiming..." : "Claim 100 Tala"}</Text>
                  </Pressable>
                </>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7FAFC" },
  topBar: {
    height: 52,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    shadowColor: "#777777",
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  backButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  topTitle: { color: "#314258", fontSize: 17, lineHeight: 23, fontWeight: "700" },
  topBarSpacer: { width: 38, height: 38 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 14, paddingTop: 18, paddingBottom: 30 },
  hero: {
    minHeight: 190,
    borderRadius: 24,
    backgroundColor: "#E9F8DD",
    borderWidth: 1,
    borderColor: "#D7EFC5",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 22,
    marginBottom: 14,
  },
  heroIconWrap: {
    width: 86,
    height: 86,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCECCF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  heroIcon: { width: 58, height: 58 },
  heroTitle: {
    color: "#304558",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 4,
  },
  heroSubtitle: {
    color: "#557144",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  loadingCard: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7EEF4",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 20,
    rowGap: 10,
  },
  loadingText: { color: "#60727B", fontSize: 13, lineHeight: 18 },
  codeCard: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7EEF4",
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
    shadowColor: "#66737E",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  codeHeader: {
    alignItems: "center",
    justifyContent: "center",
    rowGap: 10,
    marginBottom: 14,
  },
  cardEyebrow: {
    color: "#536B43",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
    textAlign: "center",
    textTransform: "uppercase",
  },
  cardTitle: { color: "#304558", fontSize: 18, lineHeight: 24, fontWeight: "800" },
  rewardPill: {
    minWidth: 78,
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: "#F3FBEA",
    borderWidth: 1,
    borderColor: "#DAEDC7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 5,
    paddingHorizontal: 10,
  },
  rewardIcon: { width: 20, height: 20 },
  rewardText: { color: "#4F7E31", fontSize: 15, lineHeight: 20, fontWeight: "800" },
  codeRow: {
    minHeight: 64,
    borderRadius: 16,
    backgroundColor: "#F6FAF2",
    borderWidth: 1,
    borderColor: "#DDEBD1",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 8,
    columnGap: 10,
  },
  codeText: {
    flex: 1,
    color: "#2E4053",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    letterSpacing: 0,
  },
  copyButton: {
    width: 46,
    height: 46,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE7EF",
    alignItems: "center",
    justifyContent: "center",
  },
  helperText: { color: "#566878", fontSize: 13, lineHeight: 18, marginTop: 2 },
  primaryButton: {
    minHeight: 50,
    borderRadius: 999,
    backgroundColor: "#79C943",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 8,
    marginBottom: 12,
  },
  primaryText: { color: "#FFFFFF", fontSize: 16, lineHeight: 20, fontWeight: "800" },
  redeemCard: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7EEF4",
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: "#66737E",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  redeemHeader: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    marginBottom: 14,
  },
  redeemIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 999,
    backgroundColor: "#F3FBEA",
    borderWidth: 1,
    borderColor: "#DAEDC7",
    alignItems: "center",
    justifyContent: "center",
  },
  redeemIcon: { width: 28, height: 28 },
  redeemHeaderText: { flex: 1 },
  textInput: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DDE4EB",
    backgroundColor: "#FAFCFD",
    paddingHorizontal: 12,
    fontSize: 16,
    lineHeight: 20,
    color: "#2D4053",
    fontWeight: "700",
  },
  errorText: { color: "#D24C59", fontSize: 13, lineHeight: 18, marginTop: 8 },
  successInline: { color: "#4E8334", fontSize: 13, lineHeight: 18, marginTop: 8, fontWeight: "700" },
  secondaryActionButton: {
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: "#31515F",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  secondaryActionText: { color: "#FFFFFF", fontSize: 15, lineHeight: 20, fontWeight: "800" },
  buttonDisabled: { opacity: 0.62 },
  successBox: {
    borderRadius: 16,
    backgroundColor: "#F4FAED",
    borderWidth: 1,
    borderColor: "#DDEAC8",
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  successCopy: { flex: 1 },
  successTitle: { color: "#345D2E", fontSize: 15, lineHeight: 20, fontWeight: "800", marginBottom: 2 },
  successText: { color: "#526A4F", fontSize: 13, lineHeight: 18 },
});
