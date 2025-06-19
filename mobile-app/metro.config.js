const { getDefaultConfig } = require('expo/metro-config');

// Get the default Expo Metro config
const config = getDefaultConfig(__dirname);

// Add any customizations here
config.resolver.alias = {
  // Add any alias configurations if needed
};

module.exports = config; 