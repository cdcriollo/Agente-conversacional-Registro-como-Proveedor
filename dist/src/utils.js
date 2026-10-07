import { mkdir, appendFile, writeFile } from "node:fs/promises";
import path from "node:path";
export async function ensureDir(dir) {
    await mkdir(dir, { recursive: true });
}
export function getByPath(source, pathValue) {
    let current = source;
    for (const part of pathValue.split(".")) {
        if (typeof current !== "object" || current === null || !(part in current)) {
            return undefined;
        }
        current = current[part];
    }
    return current;
}
export function stringifyValue(value) {
    if (value === null || value === undefined)
        return "";
    if (typeof value === "object")
        return JSON.stringify(value);
    return String(value);
}
export async function writeJsonl(file, value) {
    await ensureDir(path.dirname(file));
    await appendFile(file, `${JSON.stringify(value)}\n`, "utf8");
}
export async function writeText(file, content) {
    await ensureDir(path.dirname(file));
    await writeFile(file, content, "utf8");
}
export const TODAY = "2026-10-07";
