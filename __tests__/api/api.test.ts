import { constructGoogleCalendarRequestBody, hasErrorCode } from "../../src/api/api.js";
import { describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";

describe("hasErrorCode", () => {
    it("return true for object with numeric code", () => {
        const error = {code: 404};
        expect(hasErrorCode(error)).toBe(true);
    });

    it("return false for object with non-numeric code", () => {
        const error = {code: "404"};
        expect(hasErrorCode(error)).toBe(false);
    });

    it("return false for object without code property", () => {
        const error = {message: "Not Found"};
        expect(hasErrorCode(error)).toBe(false);
    });

    it("return false for undefined", () => {
        expect(hasErrorCode(undefined)).toBe(false);
    });
});

describe("constructGoogleCalendarRequestBody", () => {
    it("return valid GoogleCalendarRequestBody from DBCalendarDocument (timerange)", () => {
        const validTimerangeDocument = {
            _id: new ObjectId("680c24495faaa8dfdf6d1d02"),
            date: {ISOMonth: "2025-04", day: "02"},
            event: {
                start: "13:00",
                label: "Chronodrive",
                end: "20:45",
                isCreated: false
            },
            isActive: true,
            createdAt: "2025-04-26T02:09:45.403+02:00",
            updatedAt: "2025-04-27T17:04:27.424+02:00"
        };
        const requestBody = constructGoogleCalendarRequestBody(validTimerangeDocument);
        expect(requestBody).toEqual({
                summary: "Chronodrive",
                id: "680c24495faaa8dfdf6d1d02",
                description: "2025 Apr 26, 02:09 GMT+2",
                start: {dateTime: "2025-04-02T13:00:00", timeZone: "Europe/Paris"},
                end: {dateTime: "2025-04-02T20:45:00", timeZone: "Europe/Paris"}
            }
        );
    });

    it("return valid GoogleCalendarRequestBody from DBCalendarDocument (all-day)", () => {
        const validAlldayDocument = {
            _id: new ObjectId("680c24495faaa8dfdf6d1d44"),
            date: {ISOMonth: "2025-05", day: "29"},
            isActive: true,
            event: {label: "FERIE", isCreated: false},
            createdAt: "2025-04-26T02:09:45.403+02:00",
            updatedAt: "2025-04-26T02:16:21.185+02:00"
        };
        const requestBody = constructGoogleCalendarRequestBody(validAlldayDocument);
        expect(requestBody).toEqual({
            summary: "FERIE",
            id: "680c24495faaa8dfdf6d1d44",
            description: "2025 Apr 26, 02:09 GMT+2",
            start: {date: "2025-05-29", timeZone: "Europe/Paris"},
            end: {date: "2025-05-29", timeZone: "Europe/Paris"}
        });
    });


    it("return undefined for invalid date in DBCalendarDocument", () => {
        const invalidDateDocument = {
            _id: new ObjectId("680c24495faaa8dfdf6d1d01"),
            date: {ISOMonth: "2025-13", day: "32"}, // Invalid month and day
            event: {
                start: "13:00",
                label: "Invalid Event",
                end: "20:00",
                isCreated: false
            },
            isActive: true,
            createdAt: "2025-04-26T02:09:45.403+02:00",
            updatedAt: "2025-04-27T17:04:27.424+02:00"
        };

        const requestBody = constructGoogleCalendarRequestBody(invalidDateDocument);
        expect(requestBody).toBeUndefined();
    });

    it("return undefined if start time is missing", () => {
        const missingStartDocument = {
            _id: new ObjectId("680c24495faaa8dfdf6d1d01"),
            date: {ISOMonth: "2025-04", day: "10"},
            event: {
                label: "Event Missing Start",
                end: "20:00",
                isCreated: false
            },
            isActive: true,
            createdAt: "2025-04-26T02:09:45.403+02:00",
            updatedAt: "2025-04-27T17:04:27.424+02:00"
        };

        const requestBody = constructGoogleCalendarRequestBody(missingStartDocument);
        expect(requestBody).toBeUndefined();
    });

    it("return undefined if end time is missing", () => {
        const missingEndDocument = {
            _id: new ObjectId("680c24495faaa8dfdf6d1d01"),
            date: {ISOMonth: "2025-04", day: "10"},
            event: {
                start: "10:00",
                label: "Event Missing End",
                isCreated: false
            },
            isActive: true,
            createdAt: "2025-04-26T02:09:45.403+02:00",
            updatedAt: "2025-04-27T17:04:27.424+02:00"
        };

        const requestBody = constructGoogleCalendarRequestBody(missingEndDocument);
        expect(requestBody).toBeUndefined();
    });

    it("return undefined if empty document", () => {
        const emptyDocument = {};
        const requestBody = constructGoogleCalendarRequestBody(emptyDocument);
        expect(requestBody).toBeUndefined();
    });
});