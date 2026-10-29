import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  fetchOpenMeteoWeather,
  resolveUserLocationName,
  type WeatherData,
} from "../../lib/weather";

type WeatherState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: WeatherData }
  | { status: "permission_denied"; canAskAgain: boolean }
  | { status: "services_disabled" }
  | { status: "error"; message: string };

const WEATHER_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes fresh cache

function formatLastUpdated(timestamp: number): string {
  try {
    const d = new Date(timestamp);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

export function WeatherCard() {
  const [state, setState] = useState<WeatherState>({ status: "loading" });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasPromptedInitiallyRef = useRef(false);
  const lastFetchedDataRef = useRef<WeatherData | null>(null);

  // Smooth spin animation for refresh button
  const spinAnim = useRef(new Animated.Value(0)).current;

  const startSpin = () => {
    spinAnim.setValue(0);
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  };

  const stopSpin = () => {
    spinAnim.stopAnimation();
    spinAnim.setValue(0);
  };

  const resolveLocationAndWeather = useCallback(async (isUserInitiated = false) => {
    try {
      if (lastFetchedDataRef.current && !isUserInitiated) {
        const age = Date.now() - lastFetchedDataRef.current.fetchedAt;
        if (age < WEATHER_CACHE_TTL_MS) {
          setState({ status: "success", data: lastFetchedDataRef.current });
          return;
        }
      }

      if (isUserInitiated) {
        setIsRefreshing(true);
        startSpin();
      } else {
        setState({ status: "loading" });
      }

      // Check current permission status first without popping OS dialog
      let perm = await Location.getForegroundPermissionsAsync();

      if (perm.status !== Location.PermissionStatus.GRANTED) {
        if (!isUserInitiated && hasPromptedInitiallyRef.current) {
          setState({
            status: "permission_denied",
            canAskAgain: perm.canAskAgain,
          });
          setIsRefreshing(false);
          stopSpin();
          return;
        }

        hasPromptedInitiallyRef.current = true;
        perm = await Location.requestForegroundPermissionsAsync();

        if (perm.status !== Location.PermissionStatus.GRANTED) {
          setState({
            status: "permission_denied",
            canAskAgain: perm.canAskAgain,
          });
          setIsRefreshing(false);
          stopSpin();
          return;
        }
      }

      // Verify device location services (GPS) are enabled
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setState({ status: "services_disabled" });
        setIsRefreshing(false);
        stopSpin();
        return;
      }

      // Retrieve device coordinates
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;

      // Resolve friendly city and region (e.g. Makati, Valenzuela, Laguna, etc.)
      const locInfo = await resolveUserLocationName(latitude, longitude);

      const weather = await fetchOpenMeteoWeather(
        latitude,
        longitude,
        locInfo,
      );

      lastFetchedDataRef.current = weather;
      setState({ status: "success", data: weather });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unable to retrieve weather data";
      setState({ status: "error", message });
    } finally {
      setIsRefreshing(false);
      stopSpin();
    }
  }, []);

  useEffect(() => {
    void resolveLocationAndWeather(false);
  }, [resolveLocationAndWeather]);

  const handleRequestPermission = () => {
    void resolveLocationAndWeather(true);
  };

  const handleOpenSettings = async () => {
    try {
      if (Platform.OS === "android") {
        await Linking.openSettings();
      } else {
        await Linking.openURL("app-settings:");
      }
    } catch {}
  };

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // Loading State
  if (state.status === "loading" && !lastFetchedDataRef.current) {
    return (
      <View style={styles.card}>
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#5AA63D" size="small" />
          <Text style={styles.loadingText}>Fetching weather for your area...</Text>
        </View>
      </View>
    );
  }

  // Permission Denied State
  if (state.status === "permission_denied") {
    return (
      <View style={styles.card}>
        <View style={styles.stateContainer}>
          <View style={styles.stateIconWrap}>
            <Ionicons name="location-outline" size={24} color="#5F7D6B" />
          </View>
          <View style={styles.stateTextWrap}>
            <Text style={styles.stateTitle}>Location-based weather</Text>
            <Text style={styles.stateDescription}>
              Allow foreground location access to see the current forecast for your area.
            </Text>
          </View>
          {state.canAskAgain ? (
            <Pressable
              style={styles.actionButton}
              onPress={handleRequestPermission}
              accessibilityLabel="Enable location for weather"
            >
              <Text style={styles.actionButtonText}>Enable</Text>
            </Pressable>
          ) : (
            <Pressable
              style={styles.actionButton}
              onPress={handleOpenSettings}
              accessibilityLabel="Open settings for location"
            >
              <Text style={styles.actionButtonText}>Settings</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  // Location Services Disabled
  if (state.status === "services_disabled") {
    return (
      <View style={styles.card}>
        <View style={styles.stateContainer}>
          <View style={styles.stateIconWrap}>
            <Ionicons name="navigate-outline" size={24} color="#C47E3D" />
          </View>
          <View style={styles.stateTextWrap}>
            <Text style={styles.stateTitle}>Location services are off</Text>
            <Text style={styles.stateDescription}>
              Turn on device location (GPS) to view the weather for your area.
            </Text>
          </View>
          <Pressable
            style={styles.actionButton}
            onPress={handleRequestPermission}
            accessibilityLabel="Retry location check"
          >
            <Text style={styles.actionButtonText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Error State
  if (state.status === "error" && !lastFetchedDataRef.current) {
    return (
      <View style={styles.card}>
        <View style={styles.stateContainer}>
          <View style={styles.stateIconWrap}>
            <Ionicons name="cloud-offline-outline" size={24} color="#B55B5B" />
          </View>
          <View style={styles.stateTextWrap}>
            <Text style={styles.stateTitle}>Weather unavailable</Text>
            <Text style={styles.stateDescription}>
              Could not reach forecast service. Please check your connection.
            </Text>
          </View>
          <Pressable
            style={styles.actionButton}
            onPress={handleRequestPermission}
            accessibilityLabel="Retry fetching weather"
          >
            <Text style={styles.actionButtonText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const weather =
    state.status === "success"
      ? state.data
      : (lastFetchedDataRef.current as WeatherData);

  const updatedTimeLabel = formatLastUpdated(weather.fetchedAt);
  const nowHour = weather.hourly && weather.hourly.length > 0 ? weather.hourly[0] : null;
  const currentRainProb = nowHour?.rainProbability ?? (weather.precipitation > 0 ? 80 : 0);

  return (
    <View style={styles.card}>
      {/* 1. Header Row: Detected City Name, Region & Refresh Button */}
      <View style={styles.headerRow}>
        <View style={styles.locationContainer}>
          <View style={styles.locationPinBubble}>
            <Ionicons name="location" size={14} color="#346842" />
          </View>
          <View style={styles.locationTextColumn}>
            <Text style={styles.cityNameText} numberOfLines={1}>
              {weather.cityName}
            </Text>
            {weather.regionName ? (
              <Text style={styles.regionNameText} numberOfLines={1}>
                {weather.regionName}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.headerRightRow}>
          {updatedTimeLabel ? (
            <Text style={styles.updatedTimeText}>{updatedTimeLabel}</Text>
          ) : null}
          <Pressable
            style={styles.refreshIconButton}
            onPress={() => void resolveLocationAndWeather(true)}
            disabled={isRefreshing}
            accessibilityLabel="Refresh weather"
          >
            <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
              <Ionicons
                name="refresh"
                size={16}
                color={isRefreshing ? "#4F9630" : "#576A5E"}
              />
            </Animated.View>
          </Pressable>
        </View>
      </View>

      {/* 2. Main Weather Row: Large Temp + Feels Like + High/Low | Condition Icon & Description */}
      <View style={styles.heroRow}>
        <View style={styles.heroLeft}>
          <View style={styles.temperatureRow}>
            <Text style={styles.temperatureValue}>{weather.temperature}</Text>
            <Text style={styles.temperatureDegree}>°C</Text>
          </View>

          <View style={styles.secondaryTempRow}>
            <Text style={styles.feelsLikeText}>
              Feels like {weather.apparentTemperature}°
            </Text>
            <Text style={styles.dotSeparator}>•</Text>
            <Text style={styles.highLowText}>
              H: {weather.dailyHigh}°  L: {weather.dailyLow}°
            </Text>
          </View>
        </View>

        <View style={styles.heroRight}>
          <View style={styles.conditionEmblem}>
            <Ionicons
              name={weather.condition.icon}
              size={36}
              color="#2D5C39"
            />
          </View>
          <Text style={styles.conditionTitle} numberOfLines={1}>
            {weather.condition.description}
          </Text>
        </View>
      </View>

      {/* 3. Weather Highlights Bar: 3 Clean Metric Chips */}
      <View style={styles.metricsBar}>
        <View style={styles.metricChip}>
          <Ionicons name="water-outline" size={14} color="#3E7B99" />
          <View style={styles.metricChipTextWrap}>
            <Text style={styles.metricChipLabel}>Humidity</Text>
            <Text style={styles.metricChipValue}>{weather.humidity}%</Text>
          </View>
        </View>

        <View style={styles.metricChip}>
          <Ionicons name="rainy-outline" size={14} color="#457B5A" />
          <View style={styles.metricChipTextWrap}>
            <Text style={styles.metricChipLabel}>Rain Chance</Text>
            <Text style={styles.metricChipValue}>{currentRainProb}%</Text>
          </View>
        </View>

        <View style={styles.metricChip}>
          <Ionicons name="flag-outline" size={14} color="#6D7858" />
          <View style={styles.metricChipTextWrap}>
            <Text style={styles.metricChipLabel}>Wind</Text>
            <Text style={styles.metricChipValue}>{weather.windSpeed} km/h</Text>
          </View>
        </View>
      </View>

      {/* 4. Gentle Journal / Wellness Prompt */}
      {weather.condition.gentleNote ? (
        <View style={styles.gentleNoteRow}>
          <Ionicons name="sparkles" size={12} color="#4D8239" style={styles.gentleNoteIcon} />
          <Text style={styles.gentleNoteText}>
            {weather.condition.gentleNote}
          </Text>
        </View>
      ) : null}

      {/* 5. Hourly Forecast Strip */}
      {weather.hourly && weather.hourly.length > 0 ? (
        <View style={styles.hourlySection}>
          <View style={styles.hourlySectionHeader}>
            <Text style={styles.hourlySectionTitle}>TODAY'S FORECAST</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hourlyScrollContent}
          >
            {weather.hourly.map((hour, index) => {
              const isCurrent = index === 0;
              return (
                <View
                  key={`${hour.isoTime}-${index}`}
                  style={[
                    styles.hourlyCard,
                    isCurrent && styles.hourlyCardCurrent,
                  ]}
                >
                  <Text
                    style={[
                      styles.hourlyTimeText,
                      isCurrent && styles.hourlyTimeTextCurrent,
                    ]}
                  >
                    {hour.formattedTime}
                  </Text>

                  <Ionicons
                    name={hour.icon}
                    size={18}
                    color={isCurrent ? "#224A2D" : "#56705E"}
                    style={styles.hourlyIcon}
                  />

                  {hour.rainProbability !== undefined && hour.rainProbability > 15 ? (
                    <Text style={styles.hourlyRainText}>{hour.rainProbability}%</Text>
                  ) : null}

                  <Text
                    style={[
                      styles.hourlyTempText,
                      isCurrent && styles.hourlyTempTextCurrent,
                    ]}
                  >
                    {hour.temperature}°
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    shadowColor: "#112616",
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(100, 155, 115, 0.18)",
    overflow: "hidden",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: "#5B7062",
    fontFamily: "Outfit-Medium",
  },
  stateContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    gap: 12,
  },
  stateIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EFF6ED",
    alignItems: "center",
    justifyContent: "center",
  },
  stateTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  stateTitle: {
    fontSize: 14,
    fontFamily: "Outfit-Bold",
    color: "#283C2F",
    marginBottom: 2,
  },
  stateDescription: {
    fontSize: 12,
    fontFamily: "Outfit",
    color: "#657A6D",
    lineHeight: 16,
  },
  actionButton: {
    backgroundColor: "#E2F2DB",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#B8DCAB",
  },
  actionButtonText: {
    fontSize: 12,
    fontFamily: "Outfit-Bold",
    color: "#285223",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    marginRight: 10,
  },
  locationPinBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EBF5E7",
    alignItems: "center",
    justifyContent: "center",
  },
  locationTextColumn: {
    flex: 1,
  },
  cityNameText: {
    fontSize: 16,
    fontFamily: "Outfit-Bold",
    color: "#1F3325",
    letterSpacing: 0.2,
  },
  regionNameText: {
    fontSize: 11,
    fontFamily: "Outfit-Medium",
    color: "#678070",
    marginTop: -1,
  },
  headerRightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  updatedTimeText: {
    fontSize: 11,
    fontFamily: "Outfit",
    color: "#7E9285",
  },
  refreshIconButton: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: "#F4F8F3",
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    marginBottom: 10,
  },
  heroLeft: {
    flex: 1,
  },
  temperatureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  temperatureValue: {
    fontSize: 42,
    fontFamily: "Outfit-Bold",
    color: "#1E3023",
    lineHeight: 46,
  },
  temperatureDegree: {
    fontSize: 18,
    fontFamily: "Outfit-SemiBold",
    color: "#466B53",
    marginTop: 4,
    marginLeft: 2,
  },
  secondaryTempRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  feelsLikeText: {
    fontSize: 12,
    fontFamily: "Outfit-Medium",
    color: "#496853",
  },
  dotSeparator: {
    fontSize: 12,
    color: "#9BB0A2",
    marginHorizontal: 5,
  },
  highLowText: {
    fontSize: 12,
    fontFamily: "Outfit",
    color: "#687D70",
  },
  heroRight: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F8F2",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(100, 155, 115, 0.12)",
    minWidth: 100,
  },
  conditionEmblem: {
    marginBottom: 2,
  },
  conditionTitle: {
    fontSize: 12,
    fontFamily: "Outfit-Bold",
    color: "#2C4533",
    textAlign: "center",
  },
  metricsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 10,
  },
  metricChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F6F9F5",
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "rgba(100, 155, 115, 0.12)",
    gap: 6,
  },
  metricChipTextWrap: {
    flex: 1,
  },
  metricChipLabel: {
    fontSize: 10,
    fontFamily: "Outfit",
    color: "#6D8273",
  },
  metricChipValue: {
    fontSize: 12,
    fontFamily: "Outfit-Bold",
    color: "#22392A",
    marginTop: -1,
  },
  gentleNoteRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F8EE",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  gentleNoteIcon: {
    marginRight: 6,
  },
  gentleNoteText: {
    fontSize: 11,
    fontFamily: "Outfit-Medium",
    color: "#3B5F31",
    flex: 1,
    lineHeight: 15,
  },
  hourlySection: {
    borderTopWidth: 1,
    borderTopColor: "rgba(100, 155, 115, 0.12)",
    paddingTop: 10,
  },
  hourlySectionHeader: {
    marginBottom: 8,
  },
  hourlySectionTitle: {
    fontSize: 10,
    fontFamily: "Outfit-Bold",
    color: "#6E8375",
    letterSpacing: 0.8,
  },
  hourlyScrollContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 2,
  },
  hourlyCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: "#F7FAF5",
    minWidth: 50,
    borderWidth: 1,
    borderColor: "transparent",
  },
  hourlyCardCurrent: {
    backgroundColor: "#E6F3DF",
    borderColor: "#B8DCAB",
  },
  hourlyTimeText: {
    fontSize: 11,
    fontFamily: "Outfit",
    color: "#62786A",
    marginBottom: 4,
  },
  hourlyTimeTextCurrent: {
    fontFamily: "Outfit-Bold",
    color: "#26502B",
  },
  hourlyIcon: {
    marginVertical: 2,
  },
  hourlyRainText: {
    fontSize: 9,
    fontFamily: "Outfit-Bold",
    color: "#3B7A99",
    marginTop: 1,
  },
  hourlyTempText: {
    fontSize: 12,
    fontFamily: "Outfit-Bold",
    color: "#273D2F",
    marginTop: 3,
  },
  hourlyTempTextCurrent: {
    color: "#1E3D23",
  },
});

