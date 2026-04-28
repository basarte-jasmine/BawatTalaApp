const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes("epub")) {
  config.resolver.assetExts.push("epub");
}

module.exports = config;
