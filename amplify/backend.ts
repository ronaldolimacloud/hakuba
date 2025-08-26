import { defineBackend } from "@aws-amplify/backend";
import { Stack } from "aws-cdk-lib";
import { CorsHttpMethod, HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpUserPoolAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Policy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";

import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { invitesFn } from "./functions/invites/resource";

const backend = defineBackend({ auth, data, invitesFn });

// Configure Lambda logging with logGroup instead of deprecated logRetention
const lambdaStack = backend.invitesFn.resources.lambda.stack;
new LogGroup(lambdaStack, "InvitesFnLogGroup", {
  logGroupName: `/aws/lambda/${backend.invitesFn.resources.lambda.functionName}`,
  retention: RetentionDays.ONE_WEEK,
});

// HTTP API stack
const apiStack = backend.createStack("api-stack");

const userPoolAuthorizer = new HttpUserPoolAuthorizer(
  "userPoolAuth",
  backend.auth.resources.userPool,
  { userPoolClients: [backend.auth.resources.userPoolClient] }
);

const invitesIntegration = new HttpLambdaIntegration(
  "InvitesIntegration",
  backend.invitesFn.resources.lambda
);

// Create API
const httpApi = new HttpApi(apiStack, "HttpApi", {
  apiName: "app-api",
  corsPreflight: {
    allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST, CorsHttpMethod.PUT, CorsHttpMethod.DELETE],
    allowOrigins: ["*"],         // tighten in prod
    allowHeaders: ["*"],         // tighten in prod
  },
  createDefaultStage: true,
});

// Routes (User Pool auth so calls are from signed-in users)
httpApi.addRoutes({
  path: "/invites/mint",
  methods: [HttpMethod.POST],
  authorizer: userPoolAuthorizer,
  integration: invitesIntegration,
});
httpApi.addRoutes({
  path: "/invites/redeem",
  methods: [HttpMethod.POST],
  authorizer: userPoolAuthorizer,
  integration: invitesIntegration,
});

// Permit your app roles to call API
const apiPolicy = new Policy(apiStack, "ApiPolicy", {
  statements: [
    new PolicyStatement({
      actions: ["execute-api:Invoke"],
      resources: [
        httpApi.arnForExecuteApi("*", "/invites/mint"),
        httpApi.arnForExecuteApi("*", "/invites/redeem"),
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
