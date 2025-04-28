import schedule from "node-schedule";
import {DateTime, Settings} from "luxon";
import {fetchMonthlyEvents} from "./crawler/crawler.js";
import {dbGetUnsyncedEvents, dbPostCalendarSync, dbUpdate} from "./db/db.js";
import {syncGoogleCalendar} from "./api/api.js";

Settings.defaultZone = "Europe/Paris";

async function syncUnsyncedEventsWithCalendar() : Promise<void> {
    const {toCreate, toDelete} = await dbGetUnsyncedEvents();
    if (toCreate.length === 0 && toDelete.length === 0) return;

    const {created, deleted} = await syncGoogleCalendar({toCreate, toDelete});
    if (created.length === 0 && deleted.length === 0) return;

    await dbPostCalendarSync({created, deleted});
}

async function fetchEventsAndSyncCalendar() : Promise<void> {
    const now = DateTime.local();
    const ISOMonths = [now.toFormat("yyyy-MM")];

    const {calendarEvents, fetchedMonths} = await fetchMonthlyEvents(ISOMonths);
    if (fetchedMonths.length === 0) return;

    await dbUpdate(calendarEvents, fetchedMonths);
    await syncUnsyncedEventsWithCalendar();
}

schedule.scheduleJob("0 0 * * * *", fetchEventsAndSyncCalendar);
schedule.scheduleJob("0 30 * * * *", syncUnsyncedEventsWithCalendar);

await fetchEventsAndSyncCalendar();