const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes("epub")) {
  config.resolver.assetExts.push("epub");
}

// TEMP (opencode diagnostics only — revert before commit): the dev-mode Babel pass
// cannot parse html2canvas-pro's ESM build ("Static class blocks are not enabled"),
// which breaks `expo start` for every platform. That module is only ever reached
// inside `Platform.OS === "web"` in app/weekly-recap.tsx, so stub it on native.
const _resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "html2canvas-pro" && platform !== "web") {
    return { type: "empty" };
  }
  return _resolveRequest
    ? _resolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
