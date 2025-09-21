import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { unmarshall } from '@aws-sdk/util-dynamodb';

interface DynamoDBRecord {
  eventName?: 'INSERT' | 'MODIFY' | 'REMOVE';
  eventSourceARN?: string;
  dynamodb?: {
    Keys?: Record<string, any>;
    NewImage?: Record<string, any>;
    OldImage?: Record<string, any>;
  };
}

interface StreamEvent {
  Records?: DynamoDBRecord[];
}

const REGION = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'ap-southeast-2';
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME ?? '';
const STAGE_NAME = process.env.STAGE_NAME ?? 'dev';

const eventBridge = new EventBridgeClient({ region: REGION });

export const handler = async (event: StreamEvent): Promise<void> => {
  if (!event.Records || event.Records.length === 0) {
    return;
  }

  if (!EVENT_BUS_NAME) {
    console.warn('EVENT_BUS_NAME not configured; skipping event dispatch');
    return;
  }

  const entries = event.Records.flatMap((record) => {
    if (!record.eventName) return [] as any[];
    try {
      const keys = record.dynamodb?.Keys ? unmarshall(record.dynamodb.Keys) : undefined;
      const newImage = record.dynamodb?.NewImage ? unmarshall(record.dynamodb.NewImage) : undefined;
      const oldImage = record.dynamodb?.OldImage ? unmarshall(record.dynamodb.OldImage) : undefined;
      const tableArn = record.eventSourceARN ?? '';
      const detail = {
        stage: STAGE_NAME,
        eventName: record.eventName,
        keys,
        newImage,
        oldImage,
        tableArn,
      };

      return [
        {
          EventBusName: EVENT_BUS_NAME,
          Source: 'hakuba.dynamodb',
          DetailType: 'AppSyncRelay',
          Detail: JSON.stringify(detail),
        },
      ];
    } catch (error) {
      console.warn('Failed to process stream record', error);
      return [] as any[];
    }
  });

  if (entries.length === 0) {
    return;
  }

  await eventBridge.send(
    new PutEventsCommand({
      Entries: entries,
    })
  );
};
