const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Native ADB/Gradle builds create/delete ephemeral android/.cxx trees under
// node_modules; Metro's FallbackWatcher crashes (ENOENT) if it watches them.
const nativeBuildJunk = /[\\/]android[\\/]\.cxx[\\/].*/;
const existing = config.resolver.blockList;
config.resolver.blockList = existing
  ? [existing, nativeBuildJunk].flat()
  : nativeBuildJunk;

module.exports = config;
