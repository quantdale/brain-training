// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite's web backend imports a wa-sqlite .wasm asset, but `.wasm` is
// not in the SDK 57 default asset-extension list — without this the web
// bundle fails to resolve `wa-sqlite.wasm`. Native builds are unaffected.
config.resolver.assetExts.push('wasm');

module.exports = config;
