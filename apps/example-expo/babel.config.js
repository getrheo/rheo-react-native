module.exports = (api) => {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Reanimated 4 moved its babel plugin to `react-native-worklets/plugin`.
      // It MUST remain the last entry in the plugins list.
      'react-native-worklets/plugin',
    ],
  };
};
