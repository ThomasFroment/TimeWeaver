import logger from "../logger.js";
import {parseEventsFromReponse, parseJSONResponse} from "./parser.js";
import {toCustomFormat} from "./utils.js";
import config from "../config.js";
import puppeteer, {Page} from "puppeteer";

// Blocking stylesheets doesn't work since they updated the website
const BLOCKED_RESOURCES = new Set(["font", "image"]);

const PUPPETEER_OPTIONS = {
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"]
};

async function openPuppeteerBrowserAndPage() {
    const browser = await puppeteer.launch(PUPPETEER_OPTIONS);
    const page = await browser.newPage();

    await page.setRequestInterception(true);
    page.on("request", (req: puppeteer.HTTPRequest) => {
        const resourceType = req.resourceType();
        if (BLOCKED_RESOURCES.has(resourceType)) {
            void req.abort();
        } else {
            void req.continue();
        }
    });

    return {
        browser,
        page
    };
}

// Wait for a valid JSON response or timeout
async function captureValidResponse(page: Page, ISOMonth: string): Promise<JSONParsedResponse> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error("No response"));
        }, 30000);

        const responseHandler = async (response: puppeteer.HTTPResponse) => {
            if (response.headers()["content-type"] !== "application/json;charset=UTF-8") return;
            const json: unknown = await response.json();
            const parsedResponse = parseJSONResponse(json, ISOMonth);

            // The JSON response being undefined, is not an error but a valid case, we simply ignore it and wait for the next one or timeout
            if (parsedResponse) {
                clearTimeout(timeout);
                logger.debug(`Response received for month: ${ISOMonth}`);
                resolve(parsedResponse);
            }
        };

        page.on("response", (response) => void responseHandler(response));
    });
}

// Function to navigate the website and triggers JSON response for each month
async function navigateAndFetchMonthsData(page: Page, ISOMonths: string[]) {
    await page.goto(config.CHD_WEBSITE, {waitUntil: "load"});

    await page.waitForSelector("#identifierInput");
    await page.type("#identifierInput", config.CHD);
    await page.keyboard.press("Enter");

    await new Promise(resolve => setTimeout(resolve, 300));
    await page.waitForSelector("#password");
    await page.type("#password", config.CHD_PASSWORD);

    await new Promise(resolve => setTimeout(resolve, 300));
    await page.waitForSelector("[title=\"Sign On\"]");
    await page.click("[title=\"Sign On\"]");

    await new Promise(resolve => setTimeout(resolve, 500));
    await page.waitForSelector("[aria-controls='user-settings']");
    await page.click("[aria-controls='user-settings']");

    await new Promise(resolve => setTimeout(resolve, 300));
    await page.waitForSelector(`input[value='${config.CHD}/0002']`);
    await page.click(`input[value='${config.CHD}/0002']`);

    await page.waitForSelector("button[title='WPL']");
    await page.click("button[title='WPL']");

    const jsonResponses: JSONParsedResponse[] = [];
    const fetchedMonths: string[] = [];

    for (const ISOMonth of ISOMonths) {
        await page.waitForSelector("#for\\/ANMOIS");
        await new Promise(resolve => setTimeout(resolve, 2000));

        // We prepare to catch the response before we trigger it
        const jsonResponsePromise = captureValidResponse(page, ISOMonth);

        await page.$eval("#for\\/ANMOIS", (element: Element, value: string) => {
            if (element instanceof HTMLInputElement) {
                element.value = value;
            }
        }, toCustomFormat(ISOMonth));

        await page.focus("#for\\/ANMOIS");
        await page.keyboard.press("Enter");

        await page.click("#toolbar_search_input");

        try {
            jsonResponses.push(await jsonResponsePromise);
            fetchedMonths.push(ISOMonth);
        } catch (err) {
            logger.safeError("", err);
        }
    }

    return {
        jsonResponses: jsonResponses,
        fetchedMonths
    };
}

// This handle both the navigation and the parsing, the goal is to return a clean array of events
export async function fetchMonthlyEvents(ISOMonths: string[]) {
    const {browser, page} = await openPuppeteerBrowserAndPage();
    logger.info(`Crawling months: ${ISOMonths.join(", ")}`);

    const {jsonResponses, fetchedMonths} = await navigateAndFetchMonthsData(page, ISOMonths);
    await browser.close();

    return {
        calendarEvents: parseEventsFromReponse(jsonResponses),
        fetchedMonths
    };
}