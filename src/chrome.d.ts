/** Minimal Chrome extension surface used by this package. */
interface ChromeLastError {
	message?: string;
}

interface ChromeMessageSender {
	url?: string;
	tab?: { id?: number };
	id?: string;
}

interface ChromeTab {
	id?: number;
	url?: string;
}

interface ChromeRuntime {
	id?: string;
	lastError?: ChromeLastError;
	sendMessage: (
		message: unknown,
		response?: (value: unknown) => void
	) => void;
	onMessage: {
		addListener: (
			listener: (
				message: unknown,
				sender: ChromeMessageSender,
				sendResponse: (value: unknown) => void
			) => boolean | void
		) => void;
	};
	onMessageExternal: ChromeRuntime["onMessage"];
}

interface ChromeStorageArea {
	get: (
		keys: string | string[],
		callback: (items: Record<string, unknown>) => void
	) => void;
	set: (items: Record<string, unknown>, callback?: () => void) => void;
	remove: (keys: string | string[], callback?: () => void) => void;
}

interface ChromeScripting {
	executeScript: (injection: {
		target: { tabId: number };
		world?: "MAIN" | "ISOLATED";
		files?: string[];
	}) => Promise<unknown>;
}

interface ChromeNamespace {
	runtime: ChromeRuntime;
	storage: {
		local: ChromeStorageArea;
		session: ChromeStorageArea;
	};
	tabs: {
		create: (props: { url: string; active?: boolean }) => Promise<ChromeTab>;
		update: (
			tabId: number,
			props: { url?: string; active?: boolean }
		) => Promise<ChromeTab>;
		query: (query: {
			url?: string | string[];
			active?: boolean;
			currentWindow?: boolean;
		}) => Promise<ChromeTab[]>;
		sendMessage: (tabId: number, message: unknown) => Promise<unknown>;
	};
	scripting: ChromeScripting;
}

declare const chrome: ChromeNamespace;
