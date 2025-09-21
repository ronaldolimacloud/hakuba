var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(index_exports);
var import_client_eventbridge = require("@aws-sdk/client-eventbridge");
var import_util_dynamodb = require("@aws-sdk/util-dynamodb");
var REGION = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "ap-southeast-2";
var EVENT_BUS_NAME = process.env.EVENT_BUS_NAME ?? "";
var STAGE_NAME = process.env.STAGE_NAME ?? "dev";
var eventBridge = new import_client_eventbridge.EventBridgeClient({ region: REGION });
var handler = async (event) => {
  if (!event.Records || event.Records.length === 0) {
    return;
  }
  if (!EVENT_BUS_NAME) {
    console.warn("EVENT_BUS_NAME not configured; skipping event dispatch");
    return;
  }
  const entries = event.Records.flatMap((record) => {
    if (!record.eventName) return [];
    try {
      const keys = record.dynamodb?.Keys ? (0, import_util_dynamodb.unmarshall)(record.dynamodb.Keys) : void 0;
      const newImage = record.dynamodb?.NewImage ? (0, import_util_dynamodb.unmarshall)(record.dynamodb.NewImage) : void 0;
      const oldImage = record.dynamodb?.OldImage ? (0, import_util_dynamodb.unmarshall)(record.dynamodb.OldImage) : void 0;
      const tableArn = record.eventSourceARN ?? "";
      const detail = {
        stage: STAGE_NAME,
        eventName: record.eventName,
        keys,
        newImage,
        oldImage,
        tableArn
      };
      return [
        {
          EventBusName: EVENT_BUS_NAME,
          Source: "hakuba.dynamodb",
          DetailType: "AppSyncRelay",
          Detail: JSON.stringify(detail)
        }
      ];
    } catch (error) {
      console.warn("Failed to process stream record", error);
      return [];
    }
  });
  if (entries.length === 0) {
    return;
  }
  await eventBridge.send(
    new import_client_eventbridge.PutEventsCommand({
      Entries: entries
    })
  );
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
//# sourceMappingURL=index.js.map
