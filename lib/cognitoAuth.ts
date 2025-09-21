import {
  AuthenticationResultType,
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  InitiateAuthCommand,
  InitiateAuthCommandOutput,
  RespondToAuthChallengeCommand,
  SignUpCommand,
  GlobalSignOutCommand,
} from '@aws-sdk/client-cognito-identity-provider';

import { getAwsConfig } from './awsConfig';

const aws = getAwsConfig();

const client = new CognitoIdentityProviderClient({
  region: aws.region,
});

const USER_POOL_CLIENT_ID = aws.cognitoClientId;

if (!aws.region) {
  console.warn('[Auth] Missing Cognito region. Set EXPO_PUBLIC_AWS_REGION or configure expo manifest.');
}

if (!USER_POOL_CLIENT_ID) {
  console.warn('[Auth] Missing Cognito User Pool client ID. Set EXPO_PUBLIC_COGNITO_CLIENT_ID or configure expo manifest.');
}

export const signIn = async (username: string, password: string): Promise<InitiateAuthCommandOutput> => {
  const command = new InitiateAuthCommand({
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: USER_POOL_CLIENT_ID,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
    },
  });

  return client.send(command);
};

export const signUp = async (username: string, password: string, email: string) => {
  const command = new SignUpCommand({
    ClientId: USER_POOL_CLIENT_ID,
    Username: username,
    Password: password,
    UserAttributes: [
      {
        Name: 'email',
        Value: email,
      },
    ],
  });

  return client.send(command);
};

export const confirmSignUp = async (username: string, code: string) => {
  const command = new ConfirmSignUpCommand({
    ClientId: USER_POOL_CLIENT_ID,
    Username: username,
    ConfirmationCode: code,
  });

  return client.send(command);
};

export const forgotPassword = async (username: string) => {
  const command = new ForgotPasswordCommand({
    ClientId: USER_POOL_CLIENT_ID,
    Username: username,
  });

  return client.send(command);
};

export const confirmForgotPassword = async (username: string, code: string, newPassword: string) => {
  const command = new ConfirmForgotPasswordCommand({
    ClientId: USER_POOL_CLIENT_ID,
    Username: username,
    ConfirmationCode: code,
    Password: newPassword,
  });

  return client.send(command);
};

export const respondToNewPasswordChallenge = async (
  username: string,
  newPassword: string,
  session: string,
) => {
  const command = new RespondToAuthChallengeCommand({
    ChallengeName: 'NEW_PASSWORD_REQUIRED',
    ClientId: USER_POOL_CLIENT_ID,
    Session: session,
    ChallengeResponses: {
      USERNAME: username,
      NEW_PASSWORD: newPassword,
    },
  });

  return client.send(command);
};

export const refreshSession = async (refreshToken: string) => {
  const command = new InitiateAuthCommand({
    AuthFlow: 'REFRESH_TOKEN_AUTH',
    ClientId: USER_POOL_CLIENT_ID,
    AuthParameters: {
      REFRESH_TOKEN: refreshToken,
    },
  });

  return client.send(command);
};

export const globalSignOut = async (accessToken: string) => {
  const command = new GlobalSignOutCommand({
    AccessToken: accessToken,
  });

  return client.send(command);
};

export const formatAuthenticationResult = (result?: AuthenticationResultType) => {
  if (!result || !result.AccessToken || !result.IdToken) {
    return null;
  }

  const issuedAt = Date.now();
  const expiresIn = result.ExpiresIn ? result.ExpiresIn * 1000 : 0;

  return {
    accessToken: result.AccessToken,
    idToken: result.IdToken,
    refreshToken: result.RefreshToken ?? '',
    tokenType: result.TokenType ?? 'Bearer',
    expiresAt: expiresIn ? issuedAt + expiresIn : issuedAt,
  };
};

export type AuthTokens = NonNullable<ReturnType<typeof formatAuthenticationResult>>;
