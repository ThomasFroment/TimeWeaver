import { JSONFilePreset } from "lowdb/node";

interface LowdbData {
    calendarId: string;
}

const defaultData: LowdbData = {
    calendarId: ""
};

const db = await JSONFilePreset<LowdbData>("./data/db.json", defaultData);

export default db;
