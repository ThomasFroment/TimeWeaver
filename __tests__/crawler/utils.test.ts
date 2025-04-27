import { describe, expect, it } from "vitest";
import { extractTime, toCustomFormat } from "../../src/crawler/utils.js";

describe("explodeTime", () => {
    it("handle normal case with dots", () => {
        expect(extractTime("12.30-15.45")).toEqual(["12:30", "15:45"]);
    });

    it("handle case with other characters", () => {
        expect(extractTime("sometext12.30-15.45sometext")).toEqual(["12:30", "15:45"]);
    });

    it("handle case with other numbers", () => {
        expect(extractTime("4657412.30-15.4534534534")).toEqual(["12:30", "15:45"]);
    });

    it("pad hours and minutes correctly", () => {
        expect(extractTime("2.00-5.05")).toEqual(["02:00", "05:05"]);
    });

    it("return empty if input is garbage", () => {
        expect(extractTime("")).toEqual(["", ""]);
        expect(extractTime("snvjfg")).toEqual(["", ""]);
    });

    it("return empty if start or end time is missing", () => {
        expect(extractTime("12.30-")).toEqual(["", ""]);
        expect(extractTime("-15.45")).toEqual(["", ""]);
    });

    it("return empty if time is invalid", () => {
        expect(extractTime("24.30-15.45")).toEqual(["", ""]);
        expect(extractTime("12.30-94.45")).toEqual(["", ""]);

        expect(extractTime("12.30-15.78")).toEqual(["", ""]);
        expect(extractTime("12.66-15.45")).toEqual(["", ""]);
    });

    it("return empty if minutes are not two digits", () => {
        expect(extractTime("12.3-15.45")).toEqual(["", ""]);
        expect(extractTime("12.32-15.5")).toEqual(["", ""]);
    });

    it("return empty if separator is wrong", () => {
        expect(extractTime("12:30-15:45")).toEqual(["", ""]);
        expect(extractTime("12.30_15.45")).toEqual(["", ""]);
    });
});

describe("toCustomFormat", () => {
    it("convert ISOMonth to custom format", () => {
        expect(toCustomFormat("2023-10")).toEqual("10/2023");
        expect(toCustomFormat("1983-01")).toEqual("01/1983");
    });

    it("return empty if input is empty", () => {
        expect(toCustomFormat("")).toEqual("");
    });

    it("return empty if input is invalid", () => {
        expect(toCustomFormat("2023/10")).toEqual("");
        expect(toCustomFormat("asdgafga")).toEqual("");
        expect(toCustomFormat("2023-10-15")).toEqual("");
    });
});
