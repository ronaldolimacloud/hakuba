import { AuthTokens } from '../providers/AuthProvider';
import { getAwsConfig } from './awsConfig';

export class MissingAppSyncConfigError extends Error {
  constructor() {
    super('AppSync URL is not configured. Set EXPO_PUBLIC_APPSYNC_URL (and related values) or update expo.extra.APPSYNC_URL.');
    this.name = 'MissingAppSyncConfigError';
  }
}

export interface GraphQLRequest {
  query: string;
  variables?: Record<string, unknown>;
}

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export async function executeGraphQL<T>(request: GraphQLRequest, tokens: AuthTokens | null): Promise<GraphQLResponse<T>> {
  const aws = getAwsConfig();
  if (!aws.appSyncUrl) {
    throw new MissingAppSyncConfigError();
  }
  if (!tokens?.idToken && !tokens?.accessToken) {
    throw new Error('No Cognito session found. Please sign in.');
  }

  const authHeader = tokens.idToken ?? tokens.accessToken;

  const response = await fetch(aws.appSyncUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader ?? '',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GraphQL request failed: ${response.status} ${text}`);
  }

  const json = (await response.json()) as GraphQLResponse<T>;
  return json;
}
