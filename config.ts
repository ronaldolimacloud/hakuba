// Configuration file for API keys and environment variables
// In production, these should be stored in environment variables

export const config = {
  // Google Places API Key
  // Get your API key from: https://console.cloud.google.com/apis/credentials
  // Make sure to enable the Places API and restrict the key appropriately
  googlePlacesApiKey: process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || 'YOUR_GOOGLE_PLACES_API_KEY_HERE',
  
  // Other configuration options can go here
  app: {
    name: 'Hakuba',
    version: '1.0.0',
  },
};

// Type definitions for better TypeScript support
export type Config = typeof config;
