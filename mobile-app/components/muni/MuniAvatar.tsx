import { Image, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import {
  getEyeAccessoryStyle,
  getHeadAccessoryStyle,
  getMuniCollectionSource,
  MUNI_IMAGE,
  MuniLoadout,
  useSavedMuniLoadout,
} from "../../lib/muni-wardrobe";

type MuniAvatarProps = {
  loadout?: MuniLoadout;
  style?: StyleProp<ViewStyle>;
};

export function MuniAvatar({ loadout, style }: MuniAvatarProps) {
  const savedLoadout = useSavedMuniLoadout();
  const activeLoadout = loadout ?? savedLoadout;
  const equippedOutfitSource = getMuniCollectionSource("outfit", activeLoadout.outfit);
  const equippedEyeSource = getMuniCollectionSource("eye", activeLoadout.eye);
  const equippedHeadSource = getMuniCollectionSource("head", activeLoadout.head);
  const equippedEyeStyle = getEyeAccessoryStyle(activeLoadout.eye);
  const equippedHeadStyle = getHeadAccessoryStyle(activeLoadout.head);

  return (
    <View style={[styles.container, style]}>
      <Image source={MUNI_IMAGE} style={styles.layer} resizeMode="contain" />

      {equippedOutfitSource ? <Image source={equippedOutfitSource} style={styles.layer} resizeMode="contain" /> : null}

      {equippedEyeSource ? (
        <Image source={equippedEyeSource} style={[styles.layer, equippedEyeStyle]} resizeMode="contain" />
      ) : null}

      {equippedHeadSource ? (
        <Image source={equippedHeadSource} style={[styles.layer, equippedHeadStyle]} resizeMode="contain" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 96,
    height: 96,
    position: "relative",
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
});
