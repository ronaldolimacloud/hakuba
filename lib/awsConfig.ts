import Constants from 'expo-constants';

export interface AwsConfig {
  appSyncUrl: string;
  appSyncRealtimeUrl: string;
  cognitoClientId: string;
  cognitoDomain: string;
  region: string;
}

const manifest = Constants.expoConfig?.extra ?? {};

const configFromManifest: Partial<AwsConfig> = {
  appSyncUrl: manifest.APPSYNC_URL,
  appSyncRealtimeUrl: manifest.APPSYNC_REALTIME_URL,
  cognitoClientId: manifest.COGNITO_CLIENT_ID,
  cognitoDomain: manifest.COGNITO_DOMAIN,
  region: manifest.AWS_REGION,
};

const configFromEnv: Partial<AwsConfig> = {
  appSyncUrl: process.env.EXPO_PUBLIC_APPSYNC_URL,
  appSyncRealtimeUrl: process.env.EXPO_PUBLIC_APPSYNC_REALTIME_URL,
  cognitoClientId: process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID,
  cognitoDomain: process.env.EXPO_PUBLIC_COGNITO_DOMAIN,
  region: process.env.EXPO_PUBLIC_AWS_REGION,
};

const awsConfig: AwsConfig = {
  appSyncUrl: configFromEnv.appSyncUrl ?? configFromManifest.appSyncUrl ?? '',
  appSyncRealtimeUrl:
    configFromEnv.appSyncRealtimeUrl ?? configFromManifest.appSyncRealtimeUrl ?? '',
  cognitoClientId:
    configFromEnv.cognitoClientId ?? configFromManifest.cognitoClientId ?? '',
  cognitoDomain:
    configFromEnv.cognitoDomain ?? configFromManifest.cognitoDomain ?? '',
  region: configFromEnv.region ?? configFromManifest.region ?? 'ap-southeast-2',
};

export function getAwsConfig(): AwsConfig {
  return awsConfig;
}
