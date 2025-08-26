import { defineFunction } from "@aws-amplify/backend";

export const simpleInvitesFn = defineFunction({
  name: "simple-invites-fn",
  entry: "./handler.ts"
});
