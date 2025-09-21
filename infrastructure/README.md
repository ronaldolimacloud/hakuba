# Hakuba Infrastructure (AWS SAM)

This directory contains the serverless backend for the Hakuba travel app built with **AWS SAM**, **AppSync**, **Cognito**, **DynamoDB**, **Lambda**, and **EventBridge**. It replaces the Amplify-generated resources and provides an event-driven, real-time architecture suitable for production.

## Layout

- `template.yaml` – SAM template defining Cognito, AppSync, DynamoDB tables, Lambda data sources, and the EventBridge bus.
- `schema/schema.graphql` – GraphQL schema entry point for the AppSync API.
- `samconfig.toml` – Default deployment configuration (update region, stack name, and parameter overrides as needed).
- `environments/*.parameters.json` – Example parameter maps you can source when deploying different stages.

## Getting Started

1. Install the [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html).
2. Update `samconfig.toml` or create a stage-specific parameter file (e.g. `environments/dev.parameters.json`) with:
   - `StageName` – stack/environment label (dev, staging, prod).
   - `DomainPrefix` – unique Cognito hosted UI domain per region (e.g. `hakuba-dev`).
   - `AllowedCallbackUrls` / `AllowedLogoutUrls` – comma-delimited OAuth redirect URIs for mobile deep links and local web testing.
   > Social IdPs (Google, etc.) can be reintroduced later by adding the provider back to the template once credentials are ready.
3. From the repository root run the helper script (it adds `node_modules/.bin` to `PATH` so the local `esbuild` binary can be found):
   ```bash
   ./infrastructure/sam-build.sh
   ```
   Append flags as needed (e.g. `./infrastructure/sam-build.sh --cached`). The script installs root dependencies the first time; the per-function `npm install` steps are handled automatically by `sam build`, so you do not have to run them manually in `services/*`.
4. Validate and deploy as usual, for example:
   ```bash
   sam validate
   sam deploy
   ```
   `sam deploy` reads defaults from `samconfig.toml`; rerun with `--guided` only if you need to regenerate or override those saved settings. You can still point the deploy to a JSON file using `--parameter-overrides $(cat environments/dev.parameters.json | jq -r 'to_entries|map(\"\(.key)=\(.value)\")|join(" "')`.
5. After deployment, capture the stack outputs (GraphQL URLs, Cognito IDs, EventBridge bus, table names) and export them to the Expo app. A follow-up task will add a script that writes these values to `infrastructure/outputs.json` for consumption in the mobile app.

## Next Steps

- Implement Lambda resolver logic under `../services/*` and wire the AppSync resolvers in the SAM template.
- Add CI checks to run `sam build`, `sam validate`, and unit tests for the Lambda packages.
- Create a deployment script that publishes stack outputs and synchronises them with Expo config (`app.config.ts` / env vars).

For detailed migration steps see the high-level refactor plan shared in the main conversation.
