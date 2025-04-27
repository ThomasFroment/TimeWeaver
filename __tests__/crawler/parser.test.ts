import { parseEvent, parseEventsFromReponse, parseJSONResponse } from "../../src/crawler/parser.js";
import { describe, expect, it } from "vitest";
import mockJSON from "./__mocks_data__/parser.mock.json" with { type: "json" };
import mockValidResponse from "./__mocks_data__/crawler_valid_response.mock.json" with { type: "json" };
import mockInvalidResponse from "./__mocks_data__/crawler_invalid_response.mock.json" with { type: "json" };

describe("parseEventsFromResponses", () => {
    it("parse 23 events from mock data", () => {
        const {rws, eventTypes, strs, ISOMonth} = mockJSON;
        const input = {json: {rws, eventTypes, strs}, ISOMonth};

        const events = parseEventsFromReponse([input]);

        expect(events).toHaveLength(23);
    });
});

describe("parseEvent", () => {
    const {rws, eventTypes, strs, ISOMonth} = mockJSON;

    it("parse a schedule event from given row index", () => {
        const event = parseEvent(rws[0] || [], eventTypes, strs, ISOMonth);

        expect(event).toEqual({
            date: {ISOMonth, day: "02"},
            event: {start: "13:00", end: "20:45", label: "Chronodrive"}
        });
    });

    it("parse an all day long absence from given row index", () => {
        const event = parseEvent(rws[36] || [], eventTypes, strs, ISOMonth);

        expect(event).toEqual({
            date: {ISOMonth, day: "21"},
            event: {label: "JFTRAV"}
        });
    });

    it("parse an absence with start and end time from given row index", () => {
        const event = parseEvent(rws[37] || [], eventTypes, strs, ISOMonth);

        expect(event).toEqual({
            date: {ISOMonth, day: "28"},
            event: {start: "10:00", end: "17:21", label: "ECO"}
        });
    });

    it("parse nothing from given row index", () => {
        const invalidIndexes = [16, 21, 25, 28, 40, 59, 78, 79, 91];

        invalidIndexes.forEach((index) => {
            const event = parseEvent(rws[index] || [], eventTypes, strs, ISOMonth);
            expect(event).toBeUndefined();
        });
    });
});

describe("parseJSONResponse", () => {
    const ISOMonth = "2025-04";
    it("parse from valid response", () => {
        const parsed = parseJSONResponse(mockValidResponse, ISOMonth);
        expect(parsed).toEqual({
            ISOMonth,
            json: {
                rws: mockValidResponse.objects[1]?.bargrid?.rws[0]?.rw,
                strs: mockValidResponse.objects[1]?.bargrid?.strs,
                eventTypes: mockValidResponse.objects[1]?.bargrid?.eventTypes
            }
        });
    });

    it("return undefined if JSON response is invalid", () => {
        const parsed = parseJSONResponse(mockInvalidResponse, ISOMonth);
        expect(parsed).toEqual(undefined);
    });

    it("return undefined if top-level parsing fails", () => {
        const invalidJson = undefined;
        const parsed = parseJSONResponse(invalidJson, ISOMonth);
        expect(parsed).toBeUndefined();
    });

    it("return undefined if objects array is missing", () => {
        const brokenResponse = structuredClone(mockValidResponse) as any;
        delete brokenResponse.objects;

        const parsed = parseJSONResponse(brokenResponse, ISOMonth);
        expect(parsed).toBeUndefined();
    });

    it("return undefined if objects[27] has wrong value", () => {
        const wrongMonthResponse = structuredClone(mockValidResponse) as any;
        wrongMonthResponse.objects[27].value = "05/2025";

        const parsed = parseJSONResponse(wrongMonthResponse, ISOMonth);
        expect(parsed).toBeUndefined();
    });

    it("return undefined if objects[1] is missing", () => {
        const brokenResponse = structuredClone(mockValidResponse) as any;
        delete brokenResponse.objects[1];
        const parsed = parseJSONResponse(brokenResponse, ISOMonth);
        expect(parsed).toBeUndefined();
    });

    it("return undefined if bargrid is missing from objects[1]", () => {
        const missingBargridResponse = structuredClone(mockValidResponse) as any;
        delete missingBargridResponse.objects[1].bargrid;

        const parsedResponse = parseJSONResponse(missingBargridResponse, ISOMonth);
        expect(parsedResponse).toBeUndefined();
    });

    it("return undefined if bargrid schema validation fails", () => {
        const invalidBargridResponse = structuredClone(mockValidResponse) as any;
        invalidBargridResponse.objects[1].bargrid = {
            rws: [],
            invalid: []
        };

        const parsedResponse = parseJSONResponse(invalidBargridResponse, ISOMonth);
        expect(parsedResponse).toBeUndefined();
    });

    it("return undefined if bargrid.rws[0] is missing", () => {
        const brokenResponse = structuredClone(mockValidResponse) as any;
        brokenResponse.objects[1].bargrid.rws = [];
        const parsed = parseJSONResponse(brokenResponse, ISOMonth);
        expect(parsed).toBeUndefined();
    });

    it("return undefined if bargrid.rws[0].rw is missing", () => {
        const brokenResponse = structuredClone(mockValidResponse) as any;
        brokenResponse.objects[1].bargrid.rws[0] = {};
        const parsed = parseJSONResponse(brokenResponse, ISOMonth);
        expect(parsed).toBeUndefined();
    });
});
