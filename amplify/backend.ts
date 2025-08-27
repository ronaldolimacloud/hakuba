import { defineBackend } from "@aws-amplify/backend";

import { auth } from "./auth/resource";
import { data } from "./data/resource";

// Simplified backend - just auth and data, no Lambda functions needed!
const backend = defineBackend({ 
  auth, 
  data 
});
