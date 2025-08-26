import { defineBackend } from "@aws-amplify/backend";
import { Stack } from "aws-cdk-lib";
import { CorsHttpMethod, HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpUserPoolAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Policy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";

import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { authHelpersFn } from "./functions/auth-helpers/resource";
import { simpleInvitesFn } from "./functions/simple-invites/resource";

const backend = defineBackend({ auth, data, simpleInvitesFn, authHelpersFn });

// Configure Lambda logging with logGroup instead of deprecated logRetention
const simpleInvitesStack = backend.simpleInvitesFn.resources.lambda.stack;
new LogGroup(simpleInvitesStack, "SimpleInvitesFnLogGroup", {
  logGroupName: `/aws/lambda/${backend.simpleInvitesFn.resources.lambda.functionName}`,
  retention: RetentionDays.ONE_WEEK,
});

const authHelpersStack = backend.authHelpersFn.resources.lambda.stack;
new LogGroup(authHelpersStack, "AuthHelpersFnLogGroup", {
  logGroupName: `/aws/lambda/${backend.authHelpersFn.resources.lambda.functionName}`,
  retention: RetentionDays.ONE_WEEK,
});

// HTTP API stack
const apiStack = backend.createStack("api-stack");

const userPoolAuthorizer = new HttpUserPoolAuthorizer(
  "userPoolAuth",
  backend.auth.resources.userPool,
  { userPoolClients: [backend.auth.resources.userPoolClient] }
);

const simpleInvitesIntegration = new HttpLambdaIntegration(
  "SimpleInvitesIntegration",
  backend.simpleInvitesFn.resources.lambda
);

const authHelpersIntegration = new HttpLambdaIntegration(
  "AuthHelpersIntegration",
  backend.authHelpersFn.resources.lambda
);

// Create API
const httpApi = new HttpApi(apiStack, "HttpApi", {
  apiName: "app-api",
  corsPreflight: {
    allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST, CorsHttpMethod.PUT, CorsHttpMethod.DELETE],
    allowOrigins: [
      // For React Native apps, you typically don't need specific origins for CORS
      // The requests come from the device, not a browser
      '*'
    ],
    allowHeaders: [
      'Content-Type', 
      'Authorization', 
      'X-Amz-Date', 
      'X-Api-Key', 
      'X-Amz-Security-Token',
      'X-Amz-User-Agent'
    ],
    // When allowOrigin is '*', allowCredentials must be false per API Gateway constraints
    allowCredentials: false,
  },
  createDefaultStage: true,
});

// Shareable invitation routes (like TriCount)
httpApi.addRoutes({
  path: "/invite/create",
  methods: [HttpMethod.POST],
  authorizer: userPoolAuthorizer,
  integration: simpleInvitesIntegration,
});
httpApi.addRoutes({
  path: "/invite/join",
  methods: [HttpMethod.POST],
  authorizer: userPoolAuthorizer,
  integration: simpleInvitesIntegration,
});
httpApi.addRoutes({
  path: "/invite/info",
  methods: [HttpMethod.GET],
  authorizer: userPoolAuthorizer,
  integration: simpleInvitesIntegration,
});

// Auth helpers routes
httpApi.addRoutes({
  path: "/auth/check-access",
  methods: [HttpMethod.POST],
  authorizer: userPoolAuthorizer,
  integration: authHelpersIntegration,
});
httpApi.addRoutes({
  path: "/auth/get-trip-id",
  methods: [HttpMethod.POST],
  authorizer: userPoolAuthorizer,
  integration: authHelpersIntegration,
});

// Permit your app roles to call API
const apiPolicy = new Policy(apiStack, "ApiPolicy", {
  statements: [
    new PolicyStatement({
      actions: ["execute-api:Invoke"],
      resources: [
        httpApi.arnForExecuteApi("*", "/invite/create"),
        httpApi.arnForExecuteApi("*", "/invite/join"),
        httpApi.arnForExecuteApi("*", "/invite/info"),
        httpApi.arnForExecuteApi("*", "/auth/check-access"),
        httpApi.arnForExecuteApi("*", "/auth/get-trip-id"),
      ],
    }),
  ],
});

backend.auth.resources.authenticatedUserIamRole.attachInlinePolicy(apiPolicy);

// Expose endpoint/region to client config
backend.addOutput({
  custom: {
    API: {
      [httpApi.httpApiName!]: {
        endpoint: httpApi.url,
        region: Stack.of(httpApi).region,
      },
    },
  },
});
