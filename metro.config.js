const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// react-native-svg v15 has a broken "react-native" field pointing to src/
// Force Metro to use "main" (lib/commonjs) instead
config.resolver.resolverMainFields = ['main', 'module'];

module.exports = withNativeWind(config, { input: "./global.css" });
