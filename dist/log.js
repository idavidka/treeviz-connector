import { LOG_KEY } from "./protocol.js";
const LIMIT = 200;
const lines = [];
const listeners = new Set();
const stamp = () => new Date().toISOString();
export const connectorLog = (scope, message, detail) => {
    const extra = detail === undefined
        ? ""
        : ` ${typeof detail === "string" ? detail : JSON.stringify(detail)}`;
    const line = `${stamp()} [${scope}] ${message}${extra}`;
    lines.push(line);
    if (lines.length > LIMIT) {
        lines.splice(0, lines.length - LIMIT);
    }
    console.info("[TreeViz Connector]", line);
    try {
        chrome.runtime.sendMessage({ type: "connector:log", line }, () => {
            void chrome.runtime.lastError;
        });
    }
    catch {
        // The service worker is not ready yet.
    }
    listeners.forEach((listener) => listener());
};
export const recentLogLines = () => lines.slice(-12);
export const subscribeLog = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};
export const copyConnectorLog = async () => {
    const remote = await new Promise((resolve) => {
        try {
            chrome.runtime.sendMessage({ type: "connector:get-log" }, (response) => {
                void chrome.runtime.lastError;
                const body = (response ?? {});
                resolve(Array.isArray(body.lines) ? body.lines.map(String) : []);
            });
        }
        catch {
            resolve([]);
        }
    });
    const merged = [...remote];
    for (const line of lines) {
        if (!merged.includes(line)) {
            merged.push(line);
        }
    }
    const text = merged.join("\n");
    try {
        await navigator.clipboard.writeText(text);
    }
    catch {
        // The panel still shows the lines if the clipboard is blocked.
    }
    return text;
};
export const logStorageKey = LOG_KEY;
