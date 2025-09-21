# Hakuba Travel App 🏔️

A collaborative trip planning and expense tracking app built with Expo and an AWS-first backend (AppSync, Cognito, DynamoDB, Lambda, EventBridge). Plan trips together, share lists, and make group decisions in real-time.

## Features

### 🔐 Authentication
- Google OAuth sign-in via Amazon Cognito Hosted UI
- Secure user sessions with Cognito user pools
- User profile management

### 🗺️ Trip Management
- Create and manage multiple trips
- Collaborative trip planning with multiple participants
- Role-based access (owners, admins, members)

### 📝 Lists & Items
- Create multiple lists per trip (restaurants, activities, hotels, etc.)
- Add items with titles, notes, and Google Places integration
- Collaborative voting/liking system for group decision making
- Real-time synchronization across all devices

### 🔗 Share Trip Feature
- **Generate secure invitation links** with 7-day expiration
- **Multiple sharing options:**
  - WhatsApp integration with pre-filled messages
  - QR code generation for easy scanning
  - Native device sharing (SMS, email, etc.)
- **Deep linking support** (`hakuba://invite/[inviteId]`)
- **Backend API** for secure invite management

### ⚡ Real-time Collaboration
- Live updates when team members add/modify items
- Synchronized voting across all participants
- AppSync subscriptions and EventBridge events keep clients current

### 🌍 Google Places Integration
- Location-based item support
- Google Places API integration
- Proper attribution compliance

## Tech Stack

- **Frontend:** Expo (React Native)
- **Backend:** AWS SAM (AppSync, Lambda, EventBridge)
- **Database:** Amazon DynamoDB
- **Authentication:** Amazon Cognito with Google OAuth
- **Real-time:** AppSync GraphQL subscriptions + domain events
- **API:** AWS AppSync + Lambda resolvers
- **Maps:** Google Places API

## Get Started

1. Install dependencies
   ```bash
   npm install
   ```

2. Deploy the backend with AWS SAM (see `infrastructure/README.md` for details).

3. Start the development server
   ```bash
   npx expo start
   ```

### Environment configuration

Populate the following values (via `app.json` `extra` or Expo config plugins) after deploying the SAM stack:

- `APPSYNC_URL` / `APPSYNC_REALTIME_URL`
- `COGNITO_CLIENT_ID`
- `COGNITO_DOMAIN`
- `AWS_REGION`

Refer to `docs/cognito-setup.md` for the end-to-end Cognito deployment and Expo configuration steps.

4. Choose your development platform:
   - [iOS Simulator](https://docs.expo.dev/workflow/ios-simulator/)
   - [Android Emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
   - [Expo Go](https://expo.dev/go) (limited functionality)
   - [Development Build](https://docs.expo.dev/develop/development-builds/introduction/) (recommended)

## Project Structure

```
app/
├── (tabs)/
│   ├── index.tsx          # Home/Auth screen
│   ├── trip/
│   │   ├── index.tsx      # Trip list
│   │   └── [trip].tsx     # Individual trip view
│   └── _layout.tsx        # Tab navigation
├── (modals)/              # Modal screens
└── _layout.tsx            # Root layout

components/
└── ShareTripModal.tsx     # Trip sharing functionality

infrastructure/            # AWS SAM template, schema, environment params
services/                  # Lambda handler workspaces used by SAM
```

## Key Screens

- **Home:** Authentication and welcome screen
- **Trip List:** View and create trips
- **Trip Detail:** Manage lists, items, and share trips
- **Share Modal:** Invite others via WhatsApp, QR code, or other methods

## Development

This project uses:
- [Expo Router](https://docs.expo.dev/router/introduction/) for file-based routing
- [AWS SAM](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/what-is-sam.html) + [AppSync](https://docs.aws.amazon.com/appsync/) for backend services
- [TypeScript](https://www.typescriptlang.org/) for type safety
- [React Native](https://reactnative.dev/) for cross-platform development

## Learn More

- [Expo Documentation](https://docs.expo.dev/)
- [AWS Serverless Application Model](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/)
- [AWS AppSync Documentation](https://docs.aws.amazon.com/appsync/)
- [React Native Documentation](https://reactnative.dev/docs/getting-started)
