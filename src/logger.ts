import winston from "winston";
import config from "./config.js";

const customFormat = winston.format.combine(
    winston.format.errors({stack: true}),
    ...(config.NODE_ENV === "production" ? [] : [winston.format.colorize({all: true})]),
    winston.format.timestamp({ format: "DD-MM-YYYY HH:mm:ss"}),
    winston.format.printf(({timestamp, level, message, stack}) => {
        const stackStr = (typeof stack === "string") ? ("\n" + stack) : "";
        return `[${String(timestamp)}] [${level}] ${String(message)}${stackStr}`;
    })
);

interface ExtendedLogger extends winston.Logger {
    safeError(message: string, err: unknown): void;
}

const logger = winston.createLogger({
    transports: [
        new winston.transports.Console({
            level: config.NODE_ENV === "production" ? "info" : "silly",
            format: customFormat
        }),
        new winston.transports.File({
            filename: './logs/application.log',
            level: config.NODE_ENV === "production" ? "error" : "debug",
            format: winston.format.combine(winston.format.timestamp({
                format: "DD-MM-YYYY HH:mm:ss"
            }), winston.format.json())
        })
    ]
}) as ExtendedLogger;

logger.safeError = function(message: string, err: unknown): void {
    this.error(message, {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
    });
}

export default logger;
