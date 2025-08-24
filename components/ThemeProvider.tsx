import { DarkTheme, Theme } from "@react-navigation/native";

// Export a React Navigation-compatible theme. Only keys under `colors` are used
// by the navigator. You can adjust these hex values to your preferred palette.
export const hakubaTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: "red", // accent
    background: "#0B0F14",
    card: "#111827",
    text: "#E5E7EB",
    border: "#1F2937",
    notification: "#F59E0B",
  },
};

export default hakubaTheme;