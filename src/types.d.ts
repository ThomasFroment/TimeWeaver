import { ObjectId, WithId } from "mongodb";

declare global {
    type NullableValue = (number | string | null);

    interface JSONParsedResponse {
        json: {
            strs: string[]
            eventTypes: NullableValue[][];
            rws: NullableValue[][];
        };
        ISOMonth: string;
    }

    interface CalendarEvent {
        date: {
            ISOMonth: string;
            day: string;
        };
        event: {
            label?: string;
            start?: string;
            end?: string;
        };
    }

    interface DBCalendarDocument {
        _id?: ObjectId;
        date: {
            ISOMonth: string;
            day: string;
        },
        event: {
            label?: string;
            start?: string;
            end?: string;
            isCreated: boolean;
        },
        isActive: boolean;
        createdAt: string;
        updatedAt: string;
    }

    interface ApiSyncResults {
        created: ObjectId[],
        deleted: ObjectId[],
    }

    interface UnsyncedDBDocument {
        toCreate: WithId<DBCalendarDocument>[],
        toDelete: WithId<DBCalendarDocument>[],
    }

    interface GoogleCalendarRequestBody {
        summary: string,
        id: string,
        description: string,
        start: {
            dateTime?: string,
            date?: string,
            timeZone: string
        },
        end: {
            dateTime?: string,
            date?: string,
            timeZone: string
        }
    }
}

