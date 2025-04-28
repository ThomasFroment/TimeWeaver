// e.g. "1.00-02.00" => ["01:00", "02:00"]
export function extractTime(str: string): [string, string] {
    const regex = /(\d{1,2})\.(\d{2})-(\d{1,2})\.(\d{2})/;
    const match = regex.exec(str);
    if (!match) return ["", ""];

    const [, h1, m1, h2, m2] = match.map(Number);
    if (h1 === undefined || m1 === undefined || h2 === undefined || m2 === undefined) return ["", ""];

    const isValid = (h: number, m: number) => h >= 0 && h <= 23 && m >= 0 && m <= 59;
    if (!isValid(h1, m1) || !isValid(h2, m2)) return ["", ""];

    const pad = (n: number) => n.toString().padStart(2, "0");
    return [`${pad(h1)}:${pad(m1)}`, `${pad(h2)}:${pad(m2)}`];
}

// e.g. "2023-01" => "01/2023"
export function toCustomFormat(ISOMonth: string) : string {
    const regex = /^(\d{4})-(\d{2})$/;
    if (!regex.test(ISOMonth)) return "";

    const [year, month] = ISOMonth.split("-");
    if (!month || !year) return "";
    return `${month}/${year}`;
}

// The day of the month are encoded in the scrapped data, e.g. day_of_month = (val-1) / 122 + 1
export const DAY_OF_MONTH_BY_ENCODED_DAY = new Map([[1, "01"],
    [123, "02"],
    [245, "03"],
    [367, "04"],
    [489, "05"],
    [611, "06"],
    [733, "07"],
    [855, "08"],
    [977, "09"],
    [1099, "10"],
    [1221, "11"],
    [1343, "12"],
    [1465, "13"],
    [1587, "14"],
    [1709, "15"],
    [1831, "16"],
    [1953, "17"],
    [2075, "18"],
    [2197, "19"],
    [2319, "20"],
    [2441, "21"],
    [2563, "22"],
    [2685, "23"],
    [2807, "24"],
    [2929, "25"],
    [3051, "26"],
    [3173, "27"],
    [3295, "28"],
    [3417, "29"],
    [3539, "30"],
    [3661, "31"]]);
