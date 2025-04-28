import { JSONFileSyncPreset } from "lowdb/node";
import fs from "fs";

interface LowdbData {
    calendarId: string;
}

const defaultData: LowdbData = {
    calendarId: ""
};

if (!fs.existsSync("./data")){
    fs.mkdirSync("./data");
}

const db = JSONFileSyncPreset<LowdbData>("./data/db.json", defaultData);

export default db;
