const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// react-native-svg v15 has a broken "react-native" field pointing to src/
// Force Metro to use "main" (lib/commonjs) instead
config.resolver.resolverMainFields = ['main', 'module'];

// adhan v4 ships split CJS files that Metro can't resolve internally.
// Redirect to the self-contained UMD bundle which has all named exports.
const adhanUmd = path.resolve(__dirname, "node_modules/adhan/lib/bundles/adhan.umd.js");
const _originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === "adhan") {
        return { filePath: adhanUmd, type: "sourceFile" };
    }
    if (_originalResolveRequest) {
        return _originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
