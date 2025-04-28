import {google} from "googleapis";
import db from "../db/lowdb.js";
import config from "../config.js";
import {ObjectId, WithId} from "mongodb";
import logger from "../logger.js";
import {DateTime} from "luxon";
import {dbClearEvents} from "../db/db.js";
import {z} from "zod";

const JWT_CLIENT = new google.auth.JWT(config.API_EMAIL, undefined, config.API_KEY, "https://www.googleapis.com/auth/calendar");

const GOOGLE_CALENDAR = google.calendar({
    version: "v3",
    auth: JWT_CLIENT
});

// Retreive or create the calendar we are working with
async function getGoogleCalendar() : Promise<string | undefined> {
    db.read();
    let calendarId = db.data.calendarId;

    let calendarListResponse;
    try {
        calendarListResponse = await GOOGLE_CALENDAR.calendarList.list();
    } catch (err) {
        logger.safeError("", err);
        return;
    }

    if (calendarListResponse.data.items?.some(({id}) => id === calendarId)) {
        logger.debug("Calendar already exists, skipping creation...");
        return calendarId;
    }

    logger.debug("Calendar does not exist, creating a new one...");

    // The program is not designed to handle multiple calendars, so delete all existing calendars when creating a new one
    // If the user want multiple calendar he should use multiple google services accounts
    for (const item of calendarListResponse.data.items ?? []) {
        if (!item.id) continue;
        try {
            await GOOGLE_CALENDAR.calendars.delete({
                calendarId: item.id
            });
            logger.silly(`Deleting calendar : ${item.id}`);
        } catch (err) {
            logger.safeError("", err);
        }
    }

    try {
        const calendarInsertResponse = await GOOGLE_CALENDAR.calendars.insert({
            requestBody: {
                summary: "Chronodrive",
                description: "",
                timeZone: "Europe/Paris"
            }
        });

        if (!calendarInsertResponse.data.id) return;
        calendarId = calendarInsertResponse.data.id;
        logger.silly(`Calendar created : ${calendarId}`);
    } catch (err) {
        logger.safeError("", err);
        return;
    }

    try {
        // Set the calendar to be owned by the process.env.OWNER_EMAIL, he can then share it with other users
        await GOOGLE_CALENDAR.acl.insert({
            calendarId,
            requestBody: {
                role: "owner",
                scope: {
                    type: "user",
                    value: config.OWNER_EMAIL
                }
            }
        });
        logger.silly("Calendar ACL set");
    } catch (err) {
        logger.safeError("", err);
        return;
    }

    await dbClearEvents();

    db.data.calendarId = calendarId;
    db.write();

    logger.silly("Calendar ID saved to database");
    return calendarId;
}

const DB_DOCUMENT_SCHEMA = z.object({
    _id: z.instanceof(ObjectId),
    date: z.object({
        ISOMonth: z.string().regex(/^\d{4}-\d{2}$/, {message: "Expected format YYYY-MM"}),
        day: z.string().regex(/^\d{2}$/, {message: "Expected 2-digit day"})
    }),
    event: z.object({
        label: z.string(),
        start: z.string().regex(/^\d{2}:\d{2}$/, {message: "Expected format HH:MM"}).optional(),
        end: z.string().regex(/^\d{2}:\d{2}$/, {message: "Expected format HH:MM"}).optional()
    }),
    createdAt: z.string()
});

// Google Calendar API request body
export function constructGoogleCalendarRequestBody(dbDocument: WithId<DBCalendarDocument>): GoogleCalendarRequestBody | undefined {
    let event;
    try {
        event = DB_DOCUMENT_SCHEMA.parse(dbDocument);
    } catch (err) {
        logger.safeError("", err);
        return;
    }

    const date = DateTime.fromISO(`${event.date.ISOMonth}-${event.date.day}`);
    if (!date.isValid) {
        logger.safeError("", new Error("Invalid date found in database document"));
        return;
    }
    const ISODate = date.toISODate();

    const {start: eventStart, end: eventEnd} = event.event;
    if (eventStart && eventEnd) {
        return {
            summary: event.event.label,
            id: event._id.toString(),
            description: DateTime.fromISO(event.createdAt).toLocaleString(DateTime.DATETIME_FULL),
            start: {
                dateTime: `${ISODate}T${eventStart}:00`,
                timeZone: "Europe/Paris"
            },
            end: {
                dateTime: `${ISODate}T${eventEnd}:00`,
                timeZone: "Europe/Paris"
            }
        };
    }

    // If one of the start or end is not defined, we assume the event is malformed
    if (!eventStart && !eventEnd) {
        return {
            summary: event.event.label,
            id: event._id.toString(),
            description: DateTime.fromISO(event.createdAt).toLocaleString(DateTime.DATETIME_FULL),
            start: {
                date: ISODate,
                timeZone: "Europe/Paris"
            },
            end: {
                date: ISODate,
                timeZone: "Europe/Paris"
            }
        };
    }

    return;
}

// Usually googleapi errors have a code property, but not all of them
export function hasErrorCode(err: unknown): err is { code: number } {
    return typeof err === "object" && err !== null && "code" in err && typeof err.code === "number";
}

// Insert and delete the events from the Google calendar as needed (return confirmation for each event)
export async function syncGoogleCalendar(unsyncedEvents: UnsyncedDBDocument) : Promise<ApiSyncResults> {
    logger.info("Syncing calendar...");

    const syncResults: ApiSyncResults = {
        created: [],
        deleted: []
    };

    const calendarId = await getGoogleCalendar();
    if (!calendarId) return syncResults;

    const {toCreate, toDelete} = unsyncedEvents;

    for (const dbDocument of toCreate) {
        const requestBody = constructGoogleCalendarRequestBody(dbDocument);
        if (!requestBody) continue;

        try {
            await GOOGLE_CALENDAR.events.insert({
                calendarId: calendarId,
                requestBody
            });
            syncResults.created.push(dbDocument._id);
            logger.silly("Calendar event created");
        } catch (err) {
            // Failure to create the event is not critical, we can just log it and move on (the program will retry later)
            logger.safeError("", err);
        }
    }

    for (const dbDocument of toDelete) {
        try {
            await GOOGLE_CALENDAR.events.delete({
                calendarId: calendarId,
                eventId: dbDocument._id.toString()
            });
            syncResults.deleted.push(dbDocument._id);
            logger.silly("Calendar event deleted");
        } catch (err) {
            // If the error is a 404 or 410, it means the event was already deleted or never existed in the first place
            if (hasErrorCode(err) && (err.code === 404 || err.code === 410)) {
                syncResults.deleted.push(dbDocument._id);
                logger.silly("Calendar event deleted (not found)");
            } else {
                // Once again, failure to delete the event is not critical, we can just log it and move on (the program will retry later)
                logger.safeError("", err);
            }
        }
    }

    return syncResults;
}