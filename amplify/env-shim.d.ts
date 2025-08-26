import type { DataClientEnv } from "@aws-amplify/backend/function/runtime";

declare module "$amplify/env/*" {
  export const env: DataClientEnv;
}


