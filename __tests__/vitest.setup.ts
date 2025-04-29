import { vi } from "vitest";

console.log = vi.fn();

vi.mock("googleapis", () => ({
    google: {
        auth: {
            JWT: vi.fn()
        },
        calendar: vi.fn()
    }
}));

vi.mock(import("mongodb"), async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        MongoClient: vi.fn().mockReturnValue({
            connect: vi.fn(),
            db: vi.fn().mockReturnValue({
                collection: vi.fn()
            })
        })
    };
});

vi.mock("../src/config.js", () => ({
    default: {}
}));

vi.mock("../src/logger.js", () => ({
    default: {
        silly: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), safeError: vi.fn()
    }
}));

