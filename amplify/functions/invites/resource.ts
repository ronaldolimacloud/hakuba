import { defineFunction } from "@aws-amplify/backend";

export const invitesFn = defineFunction({
  name: "invites-fn",
  // If you want configurable expiry defaults, add env here and set in backend:
  // environment: { INVITE_DEFAULT_HOURS: "72" },
});