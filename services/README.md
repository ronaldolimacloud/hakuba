# Hakuba Lambda Services

This workspace houses the Lambda functions referenced by the new SAM template:

- `graphql-handlers` – consolidated AppSync resolver entry point for business logic, invite workflows, and EventBridge relays.
- `event-dispatcher` – DynamoDB stream consumer that emits normalised domain events onto the shared EventBridge bus.

## Current status

- `graphql-handlers` implements all queries and mutations defined in `schema.graphql`, including trip/list/item/invite workflows and invite status validation. Requests are authorised against Cognito identities and DynamoDB tables, and domain events are pushed to EventBridge for downstream subscriptions.
- `event-dispatcher` consumes DynamoDB streams and replays them onto EventBridge (`detail-type: AppSyncRelay`) so the resolver Lambda can fan updates out to WebSocket subscribers.

## Next steps

1. Add automated test coverage (Jest/Vitest) for the resolver helpers and stream dispatch logic.
2. Optimise data access (e.g. replace Scan operations with targeted GSIs or query tables dedicated to membership lookups).
3. Extend the event relay to publish richer detail types or trigger downstream workflows (notifications, analytics, etc.).
4. Wire CI to run `sam build && sam validate` and execute the service-level tests before deployment.

The SAM build uses `esbuild`, so each package stays lightweight without bespoke tooling. Install dependencies locally with `npm install` before running `sam build` or tests.
