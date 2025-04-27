import { DAY_OF_MONTH_BY_ENCODED_DAY, extractTime, toCustomFormat } from "./utils.js";
import logger from "../logger.js";
import { z } from "zod";

const VALID_ABSENCES = [
    "FOR", // Formation
    "JFTRAV", // Jour férié de travail
    "FERIE", // Jour férié
    "ABSINJH", // Absence injustifiée
    "INDISP", // Indisponibilité
    "CP", // Congé payé
    "ECO", // École
    "ETPA" // Entretien personnel annuel
];

// Try to parse an event from a rw (row) of the JSON response
export function parseEvent(rw: NullableValue[], eventTypes: NullableValue[][], strs: string[], ISOMonth: string) {
    // Basically we have a rw that point to an eventType entry which itself point to a string (the label of the event)
    const eventTypeIndex = rw[3];
    const strIndex = typeof eventTypeIndex === "number" ? eventTypes[eventTypeIndex]?.[0] : undefined;
    const eventStr = typeof strIndex === "number" ? strs[strIndex] : undefined;

    // Encoded day
    const dayIndex = rw[4];

    if (!eventStr || typeof dayIndex !== "number") return;

    const day = DAY_OF_MONTH_BY_ENCODED_DAY.get(dayIndex);
    if (!day) return;

    const date = {ISOMonth, day};
    // If the event string contains a valid absence label we parse it as an absence
    const eventLabel = VALID_ABSENCES.find((v) => eventStr.includes(v));

    const [start, end] = extractTime(eventStr);
    if (eventLabel !== undefined) {
        if (start && end) {
            logger.silly(`Parsed absence: ${eventLabel} (${start} - ${end}) on ${day}/${ISOMonth}`);
            return {date, event: {start, end, label: eventLabel}} as CalendarEvent;
        }

        logger.silly(`Parsed absence: ${eventLabel} on ${day}/${ISOMonth}`);
        return {date, event: {label: eventLabel}} as CalendarEvent;
    }

    // If the event string does not contain a valid absence label we parse it as a normal event
    // The check for '(' is to avoid parsing an absence that is not in the VALID_ABSENCES list
    if (start && end && !eventStr.includes("(")) {
        logger.silly(`Parsed schedule: (${start} - ${end}) on ${day}/${ISOMonth}`);
        return {date, event: {start, end, label: "Chronodrive"}} as CalendarEvent;
    }

    return;
}

export function parseEventsFromReponse(jsonResponses: JSONParsedResponse[]): CalendarEvent[] {
    const events = jsonResponses.flatMap(({json: {eventTypes, strs, rws}, ISOMonth}) => {
        // rws is an array of arrays, each inner array (rw) could point to an event
        return rws.reduce((acc: CalendarEvent[], rw) => {
            const event = parseEvent(rw, eventTypes, strs, ISOMonth);
            if (event) acc.push(event);
            return acc;
        }, []);
    });

    logger.debug(`Parsed ${String(events.length)} events from JSON responses`);
    return events;
}

const NULLABLE_SCHEMA = z.union([z.string(), z.number(), z.null()]);

const BARGRID_SCHEMA = z.object({
    strs: z.array(z.string()), eventTypes: z.array(z.array(NULLABLE_SCHEMA)), rws: z.tuple([z.object({
        rw: z.array(z.array(NULLABLE_SCHEMA))
    })]).rest(z.any())
});

const JSON_RESPONSE_SCHEMA = z.object({
    objects: z.array(z.unknown()).min(28)
});

// Extract the useful data from the JSON response (if it is valid, otherwise return undefined)
export function parseJSONResponse(json: unknown, ISOMonth: string) {
    const topLevel = JSON_RESPONSE_SCHEMA.safeParse(json); // json.objects
    if (!topLevel.success) return;

    const {objects} = topLevel.data;

    const monthParsed = z.object({value: z.string()}).safeParse(objects[27]); // json.objects[27].value
    if (!monthParsed.success) return;
    if (monthParsed.data.value !== toCustomFormat(ISOMonth)) return;

    const bargridContainer = z.object({bargrid: z.unknown()}).safeParse(objects[1]); // json.objects[1].bargrid
    if (!bargridContainer.success) return;

    const bargrid = BARGRID_SCHEMA.safeParse(bargridContainer.data.bargrid); // json.objects[1].bargrid.strs, json.objects[1].bargrid.eventTypes, json.objects[1].bargrid.rws[0].rw
    if (!bargrid.success) return;

    return {
        json: {
            strs: bargrid.data.strs, eventTypes: bargrid.data.eventTypes, rws: bargrid.data.rws[0].rw
        }, ISOMonth
    } as JSONParsedResponse;
}