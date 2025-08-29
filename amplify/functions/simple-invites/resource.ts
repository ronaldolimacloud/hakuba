import { defineFunction } from "@aws-amplify/backend";

export const simpleInvites = defineFunction({
  name: "simple-invites",
  entry: "./handler.ts",
});