import { defineBackend } from "@aws-amplify/backend";

import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { authHelpers } from "./functions/auth-helpers/resource";
import { simpleInvites } from "./functions/simple-invites/resource";

const backend = defineBackend({ 
  auth, 
  data,
  authHelpers,
  simpleInvites
});
