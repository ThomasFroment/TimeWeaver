import {z} from "zod";

// Perform basic validation on environment variables
const ENV_SCHEMA = z.object({
    API_KEY: z.string().trim().min(1, {message: "API_KEY cannot be empty"}),
    API_EMAIL: z.string().trim().email().min(1, {message: "API_EMAIL cannot be empty"}),
    OWNER_EMAIL: z.string().trim().email().min(1, {message: "OWNER_EMAIL cannot be empty"}),
    CHD: z.string().trim().regex(/^CHD\d{7}$/, {message: "CHD format must be CHD followed by 7 digits"}),
    CHD_PASSWORD: z.string().trim().min(1, {message: "CHD_PASSWORD cannot be empty"}),
    CHD_WEBSITE: z.string().trim().url().min(1, {message: "CHD_WEBSITE cannot be empty"}),
    MONGODB_URI: z.string().trim().url().startsWith("mongodb://").min(1, {message: "MONGODB_URI cannot be empty"}),
    PUPPETEER_EXECUTABLE_PATH: z.string().trim().min(1).optional(),
    NODE_ENV: z.enum(["development", "production"])
});

const config = ENV_SCHEMA.parse(process.env);

export default config;