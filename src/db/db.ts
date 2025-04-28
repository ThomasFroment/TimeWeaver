import {MongoClient, ObjectId} from "mongodb";
import logger from "../logger.js";
import {DateTime} from "luxon";
import config from "../config.js";
import {flatten} from "flat";

// Update the database with an array of events while keeping a history of the events modifications
export async function dbUpdate(monthlyEvents: CalendarEvent[], fetchedMonths: string[]): Promise<void> {
    logger.info("Updating the database with the events...");
    const existingEvents = await collection
        .find({
            "date.ISOMonth": {$in: fetchedMonths},
            isActive: true
        }, {projection: {_id: 1}})
        .toArray();
    logger.debug(`Found ${String(existingEvents.length)} existing events in the database for the months: ${fetchedMonths.join(", ")}`);

    // Set of string because two ObjectId might be different but have the same value (reference is different)
    const ids = new Set<string>();
    existingEvents.forEach((event) => {
        ids.add(String(event._id));
    });

    const currTime = DateTime.local().toISO();

    for (const event of monthlyEvents) {
        const query: Record<string, unknown> = flatten(event);
        query["isActive"] = true;

        const update = {
            $setOnInsert: {
                createdAt: currTime,
                "event.isCreated": false
            },
            $set: {updatedAt: currTime}
        };

        // It will only update the updatedAt field if the event already exists in the database
        // If the event does not exist, it will insert a new document
        const dbUpdateRes = await collection.findOneAndUpdate(query, update, {
            includeResultMetadata: true,
            upsert: true
        });

        if (dbUpdateRes.lastErrorObject?.["updatedExisting"] && dbUpdateRes.value?._id) {
            ids.delete(dbUpdateRes.value._id.toString());
            logger.silly(`Updated event in the database: ${String(dbUpdateRes.value._id)}`);
        }
    }

    // De-activate all the events that were already in the database but not in the new events (that means they are not active anymore)
    if (ids.size > 0) {
        await collection.updateMany({
            _id: {$in: [...ids].map(id => new ObjectId(id))},
            isActive: true
        }, {$set: {isActive: false}});
    }
    logger.debug(`De-activated ${String(ids.size)} events in the database for the months: ${fetchedMonths.join(", ")}`);
}

// Post the results of the calendar sync to the database
export async function dbPostCalendarSync(syncResults: ApiSyncResults): Promise<void> {
    logger.info("Posting calendar sync results to the database...");

    try {
        await collection.updateMany({_id: {$in: syncResults.created}}, {$set: {"event.isCreated": true}});

        await collection.updateMany({_id: {$in: syncResults.deleted}}, {$set: {"event.isCreated": false}});
    } catch (err) {
        logger.safeError("", err);
    }
    logger.debug(`${String(syncResults.created.length)} events created and ${String(syncResults.deleted.length)} events deleted`);
}

// Un-link all database items from the Google calendar. (e.g. when the program creates a new calendar)
export async function dbClearEvents(): Promise<void> {
    logger.info("Clearing events in the database...");
    await collection.updateMany({"event.isCreated": true}, {$set: {"event.isCreated": false}});
}

// Return all the events that are not synced with the Google calendar
// (e.g. event that are active but not created in the Google calendar or event that are no longer active but still created in the Google calendar)
export async function dbGetUnsyncedEvents(): Promise<UnsyncedDBDocument> {
    logger.info("Getting unsynced events from the database...");
    const [toCreate, toDelete] = await Promise.all([collection.find({
        "event.isCreated": false,
        isActive: true
    }).toArray(), collection.find({
        "event.isCreated": true,
        isActive: false
    }).toArray()]);
    logger.debug(`Found ${String(toCreate.length)} events to create and ${String(toDelete.length)} events to delete`);

    return {
        toCreate,
        toDelete
    };
}

const client = new MongoClient(config.MONGODB_URI);
await client.connect();

const db = client.db("calendar");
// The collection name is the user CHD, which mean multiple instances of the app for different users can be run at the same time
const collection = db.collection<DBCalendarDocument>(config.CHD);