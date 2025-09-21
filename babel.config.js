module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      '@babel/plugin-transform-class-static-block',
      // This must be listed last per Reanimated requirements
      'react-native-reanimated/plugin'
    ]
  };
};
