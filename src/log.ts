import { LOG_KEY } from "./protocol.js";

const LIMIT = 200;
const lines: string[] = [];
const listeners = new Set<() => void>();

const stamp = (): string => new Date().toISOString();

export const connectorLog = (
	scope: string,
	message: string,
	detail?: unknown
): void => {
	const extra =
		detail === undefined
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
	} catch {
		// The service worker is not ready yet.
	}
	listeners.forEach((listener) => listener());
};

export const recentLogLines = (): string[] => lines.slice(-12);

export const subscribeLog = (listener: () => void): (() => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

export const copyConnectorLog = async (): Promise<string> => {
	const remote = await new Promise<string[]>((resolve) => {
		try {
			chrome.runtime.sendMessage({ type: "connector:get-log" }, (response) => {
				void chrome.runtime.lastError;
				const body = (response ?? {}) as { lines?: unknown };
				resolve(Array.isArray(body.lines) ? body.lines.map(String) : []);
			});
		} catch {
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
	} catch {
		// The panel still shows the lines if the clipboard is blocked.
	}
	return text;
};

export const logStorageKey = LOG_KEY;
