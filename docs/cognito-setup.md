# Cognito Authentication Setup

This guide connects the Expo client in this repo to the Cognito resources provisioned by the SAM template under `infrastructure/`.

## Prerequisites
- AWS account with permission to create Cognito, AppSync, DynamoDB, Lambda, and EventBridge resources.
- AWS CLI and SAM CLI installed and configured (`aws configure`).
- Node.js/npm installed for building both the mobile app and the SAM functions.

## 1. Configure OAuth redirect URIs
Edit `infrastructure/environments/dev.parameters.json` (or the stage file you deploy) before running `sam deploy`:

```json
{
  "StageName": "dev",
  "DomainPrefix": "hakuba-dev",            // choose a globally unique value per region
  "AllowedCallbackUrls": "hakuba://auth/callback,https://localhost",
  "AllowedLogoutUrls": "hakuba://auth/signout,https://localhost"
}
```

- Keep the `hakuba://auth/*` entries – they match the Expo Router screens (`app/auth/callback.tsx` and `app/auth/signout.tsx`).
- Add any additional redirect URIs you need, such as the Expo Go redirect when testing without a dev build. Run the app once and inspect the value returned by `Linking.createURL('auth/callback')` (it may look like `exp+hakuba://127.0.0.1:19000/--/auth/callback`) and append it to both parameter lists before deploying.

## 2. Build and deploy the SAM stack
From the repo root:

```bash
./infrastructure/sam-build.sh
sam deploy --config-file infrastructure/samconfig.toml --parameter-overrides $(cat infrastructure/environments/dev.parameters.json | jq -r 'to_entries|map("\(.key)=\(.value)")|join(" ")')
```

- The helper script ensures local `esbuild` binaries are on `PATH` before `sam build` runs.
- The deploy step can be customised per stage (e.g. `sam deploy --config-env staging`).

After a successful deploy, capture the CloudFormation outputs. You will need the following values:

| CloudFormation Output | Expo env var / config key          |
| --------------------- | ---------------------------------- |
| `UserPoolClientId`    | `EXPO_PUBLIC_COGNITO_CLIENT_ID`    |
| `UserPoolDomainUri`   | `EXPO_PUBLIC_COGNITO_DOMAIN`       |
| `GraphQLApiUrl`       | `EXPO_PUBLIC_APPSYNC_URL`          |
| `GraphQLRealtimeUrl`  | `EXPO_PUBLIC_APPSYNC_REALTIME_URL` |
| `AWS::Region`         | `EXPO_PUBLIC_AWS_REGION`           |

## 3. Provide the values to the Expo app
You can inject the values via environment variables (recommended for development builds) or by editing `app.json` `expo.extra`.

### Option A – environment variables (`.env.local`)

Create a file named `.env.local` in the project root:

```ini
EXPO_PUBLIC_COGNITO_CLIENT_ID=your_client_id
EXPO_PUBLIC_COGNITO_DOMAIN=https://hakuba-dev.auth.ap-southeast-2.amazoncognito.com
EXPO_PUBLIC_APPSYNC_URL=https://<graphql-id>.appsync-api.ap-southeast-2.amazonaws.com/graphql
EXPO_PUBLIC_APPSYNC_REALTIME_URL=wss://<graphql-id>.appsync-realtime-api.ap-southeast-2.amazonaws.com/graphql
EXPO_PUBLIC_AWS_REGION=ap-southeast-2
```

Expo automatically loads files that follow the `.env.*` pattern when running `npx expo start`. The `EXPO_PUBLIC_` prefix ensures the values are baked into the JavaScript bundle and available via `process.env`.

### Option B – static values in `app.json`

Update the `expo.extra` block if you prefer to hard-code a stage:

```json
"extra": {
  "APPSYNC_URL": "https://...",
  "APPSYNC_REALTIME_URL": "wss://...",
  "COGNITO_CLIENT_ID": "...",
  "COGNITO_DOMAIN": "https://...",
  "AWS_REGION": "ap-southeast-2"
}
```

## 4. Test sign-in and sign-out
1. Start the dev server with `npx expo start`.
2. Launch a development build or Expo Go client that recognises the custom scheme `hakuba://` (the default `app.json` already declares it).
3. Tap **Sign in**. Cognito Hosted UI should open in a browser tab; complete the authentication flow.
4. The app will deep link to `/auth/callback`, exchange the code for tokens, and persist the session. The home tab will now display the signed-in user profile.
5. Use **Sign Out** to verify the logout flow; the Hosted UI should redirect to `/auth/signout` and close the browser tab automatically.

### Creating users / adding social providers
- The current SAM template enables the Cognito user pool native authentication. You can seed users manually through the Cognito console or invite real users.
- To add Google (or other social) sign-in, configure an identity provider in Cognito and include it in the `UserPoolClient` (`SupportedIdentityProviders`). Keep the Hosted UI redirects in sync with the values above.

With the values configured, the Expo app will automatically pick up `getAwsConfig()` and use Cognito tokens when calling AppSync.
