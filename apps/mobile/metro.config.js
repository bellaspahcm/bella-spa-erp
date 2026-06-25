// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
// Force Metro to use local node_modules, not root monorepo node_modules
const localNodeModules = path.resolve(projectRoot, 'node_modules');

const config = getDefaultConfig(projectRoot);

// Override all Metro module paths to use local node_modules only
config.watchFolders = [projectRoot];
config.resolver.nodeModulesPaths = [localNodeModules];
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

// Force Metro resolver to use local packages
config.resolver.extraNodeModules = new Proxy(
  {},
  {
    get: (target, name) => {
      return path.join(localNodeModules, name.toString());
    },
  }
);

module.exports = config;
