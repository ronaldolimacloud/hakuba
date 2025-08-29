import { defineFunction } from "@aws-amplify/backend";

export const authHelpers = defineFunction({
  name: "auth-helpers",
  entry: "./handler.ts",
});