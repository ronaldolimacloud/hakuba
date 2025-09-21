// Metro configuration for Expo
// Maps Node's "buffer" module to the browser-compatible polyfill
const { getDefaultConfig } = require('@expo/metro-config');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

config.resolver = {
	...config.resolver,
	extraNodeModules: {
		...(config.resolver?.extraNodeModules || {}),
		buffer: require.resolve('buffer/'),
	},
};

module.exports = config;


