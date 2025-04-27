import winston, { Logger } from "winston";
import config from "./config.js";

const format: winston.Logform.Format = winston.format.combine(winston.format.errors({stack: true}), ...(config.NODE_ENV === "production" ? [] : [winston.format.colorize({all: true})]), winston.format.timestamp({
    format: "DD-MM-YYYY HH:mm:ss"
}), winston.format.printf(({timestamp, level, message, stack}) => {
    const stackStr = (typeof stack === "string") ? ("\n" + stack) : "";
    return `[${String(timestamp)}] [${level}] ${String(message)}${stackStr}`;
}));

const logger: Logger = winston.createLogger({
    level: config.NODE_ENV === "production" ? "info" : "silly", format, transports: [new winston.transports.Console()]
});

export default logger;
