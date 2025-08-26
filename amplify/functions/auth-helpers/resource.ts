import { defineFunction } from "@aws-amplify/backend";

export const authHelpersFn = defineFunction({
  name: "auth-helpers-fn",
  entry: "./handler.ts",
});
