import { ancestryFactsUrl } from "./parse-url.js";
import {
	BATCH_KEY,
	INDEX_KEY,
	LOG_KEY,
	PERSON_CAP,
	type AncestryBatch,
	type AncestryBatchPerson,
	type ConnectorIndex,
	type ConnectorFact,
	type ConnectorPerson,
	type ConnectorTree,
} from "./protocol.js";

const TREE_HOSTS = [
	"https://treeviz.com",
	"https://www.treeviz.com",
	"https://dev.treeviz.com",
	"https://qa.treeviz.com",
	"http://localhost",
];

const allowedPage = (url?: string): boolean => {
	if (!url) {
		return false;
	}
	try {
		const parsed = new URL(url);
		const origin = `${parsed.protocol}//${parsed.hostname}`;
		return TREE_HOSTS.includes(origin);
	} catch {
		return false;
	}
};

const storageGet = (area: ChromeStorageArea, key: string): Promise<unknown> =>
	new Promise((resolve) => {
		area.get(key, (items) => resolve(items[key]));
	});

const storageSet = (
	area: ChromeStorageArea,
	items: Record<string, unknown>
): Promise<void> =>
	new Promise((resolve) => {
		area.set(items, () => resolve());
	});

const storageRemove = (area: ChromeStorageArea, key: string): Promise<void> =>
	new Promise((resolve) => {
		area.remove(key, () => resolve());
	});

const asIndex = (value: unknown): ConnectorIndex | undefined => {
	if (!value || typeof value !== "object") {
		return undefined;
	}
	const index = value as ConnectorIndex;
	if (!Array.isArray(index.trees) || typeof index.uid !== "string") {
		return undefined;
	}
	return index;
};

const trimPerson = (person: ConnectorPerson): ConnectorPerson | undefined => {
	if (!person || typeof person.sourcePersonId !== "string" || !person.xref) {
		return undefined;
	}
	return {
		xref: String(person.xref),
		sourcePersonId: String(person.sourcePersonId).replace(/[^\d]/g, ""),
		name: String(person.name || ""),
		givenName: person.givenName,
		surname: person.surname,
		sex: person.sex,
		birthDate: person.birthDate,
		birthPlace: person.birthPlace,
		deathDate: person.deathDate,
		deathPlace: person.deathPlace,
		marriageDate: person.marriageDate,
		marriagePlace: person.marriagePlace,
		sourceUrl: person.sourceUrl,
		parentIds: idList(person.parentIds),
		spouseIds: idList(person.spouseIds),
		childIds: idList(person.childIds),
		facts: factList(person.facts),
	};
};

const factList = (value: unknown): ConnectorFact[] | undefined => {
	if (!Array.isArray(value)) {
		return undefined;
	}
	const facts: ConnectorFact[] = [];
	for (const item of value) {
		if (!item || typeof item !== "object") {
			continue;
		}
		const record = item as { title?: unknown; value?: unknown };
		const title = String(record.title ?? "").trim();
		const factValue = String(record.value ?? "").trim();
		if (!title || !factValue) {
			continue;
		}
		facts.push({ title, value: factValue });
		if (facts.length >= 80) {
			break;
		}
	}
	return facts;
};

const idList = (value: unknown): string[] | undefined => {
	if (!Array.isArray(value)) {
		return undefined;
	}
	const ids = value
		.map((item) => String(item).replace(/[^\d]/g, ""))
		.filter(Boolean);
	return ids;
};

const trimTree = (tree: ConnectorTree): ConnectorTree | undefined => {
	if (!tree || (tree.source !== "ancestry" && tree.source !== "myheritage")) {
		return undefined;
	}
	const persons = (tree.persons || [])
		.map(trimPerson)
		.filter((person): person is ConnectorPerson => Boolean(person))
		.slice(0, PERSON_CAP);
	return {
		uniqueId: String(tree.uniqueId || ""),
		name: String(tree.name || tree.source),
		source: tree.source,
		sourceTreeId: tree.sourceTreeId ? String(tree.sourceTreeId) : undefined,
		active: Boolean(tree.active),
		persons,
	};
};

const acceptIndex = (message: Record<string, unknown>): ConnectorIndex => {
	const trees = Array.isArray(message.trees) ? message.trees : [];
	const trimmed = trees
		.map((tree) => trimTree(tree as ConnectorTree))
		.filter((tree): tree is ConnectorTree => Boolean(tree));
	let count = 0;
	for (const tree of trimmed) {
		count += tree.persons.length;
	}
	return {
		uid: String(message.uid || ""),
		publishedAt: Number(message.publishedAt) || Date.now(),
		truncated: Boolean(message.truncated) || count >= PERSON_CAP,
		trees: trimmed,
	};
};

const digits = (value: unknown): string => String(value ?? "").replace(/[^\d]/g, "");

const acceptBatch = (message: Record<string, unknown>): AncestryBatch | undefined => {
	if (!Array.isArray(message.people)) {
		return undefined;
	}
	const people: AncestryBatchPerson[] = [];
	for (const raw of message.people) {
		if (!raw || typeof raw !== "object") {
			continue;
		}
		const person = raw as AncestryBatchPerson;
		const treeId = digits(person.treeId);
		const personId = digits(person.personId);
		if (!treeId || !personId || !Array.isArray(person.facts)) {
			continue;
		}
		people.push({
			treeId,
			personId,
			facts: person.facts.filter(
				(fact) => fact && typeof fact.type === "string" && fact.from && fact.to
			),
		});
	}
	if (!people.length) {
		return undefined;
	}
	return { people, cursor: 0, errors: [] };
};

const LOG_LIMIT = 200;

const appendLog = async (line: string): Promise<void> => {
	const current = await storageGet(chrome.storage.session, LOG_KEY);
	const lines = Array.isArray(current) ? current.map(String) : [];
	lines.push(line);
	if (lines.length > LOG_LIMIT) {
		lines.splice(0, lines.length - LOG_LIMIT);
	}
	await storageSet(chrome.storage.session, { [LOG_KEY]: lines });
	console.info("[TreeViz Connector]", line);
};

const openBatchPerson = async (batch: AncestryBatch): Promise<void> => {
	const person = batch.people[batch.cursor];
	if (!person) {
		await storageRemove(chrome.storage.session, BATCH_KEY);
		return;
	}
	const url = ancestryFactsUrl(person.treeId, person.personId);
	let tabId = batch.tabId;
	if (tabId == null) {
		const created = await chrome.tabs.create({ url, active: true });
		tabId = created.id;
	} else {
		await chrome.tabs.update(tabId, { url, active: true });
	}
	batch.tabId = tabId;
	await storageSet(chrome.storage.session, { [BATCH_KEY]: batch });
	await appendLog(
		`${new Date().toISOString()} [background] open ancestry ${person.treeId}/${person.personId} tab=${tabId ?? "none"}`
	);
	if (tabId != null) {
		window.setTimeout(() => {
			chrome.tabs.sendMessage(tabId as number, { type: "connector:run-batch" }).catch(
				() => undefined
			);
		}, 1500);
	}
};

const onMessage = (
	message: unknown,
	sender: ChromeMessageSender,
	sendResponse: (value: unknown) => void
): boolean => {
	const body = (message ?? {}) as Record<string, unknown>;
	const type = body.type;
	const external = sender.id !== chrome.runtime.id && sender.url;
	if (external && !allowedPage(sender.url)) {
		void appendLog(
			`${new Date().toISOString()} [background] rejected message from ${sender.url ?? "unknown"}`
		);
		sendResponse({ ok: false });
		return false;
	}

	if (type === "connector:log") {
		if (typeof body.line === "string") {
			void appendLog(body.line).then(() => sendResponse({ ok: true }));
			return true;
		}
		sendResponse({ ok: false });
		return false;
	}

	if (type === "connector:get-log") {
		void storageGet(chrome.storage.session, LOG_KEY).then((value) =>
			sendResponse({ ok: true, lines: Array.isArray(value) ? value : [] })
		);
		return true;
	}

	if (type === "treeviz:ping") {
		void appendLog(`${new Date().toISOString()} [background] ping from TreeViz`);
		sendResponse({ ok: true });
		return false;
	}

	if (type === "treeviz:clear") {
		void storageRemove(chrome.storage.local, INDEX_KEY).then(() =>
			sendResponse({ ok: true })
		);
		return true;
	}

	if (type === "treeviz:index") {
		const index = acceptIndex(body);
		const people = index.trees.reduce((sum, tree) => sum + tree.persons.length, 0);
		void storageSet(chrome.storage.local, { [INDEX_KEY]: index }).then(() => {
			void appendLog(
				`${new Date().toISOString()} [background] index uid=${index.uid} trees=${index.trees.map((tree) => `${tree.source}:${tree.sourceTreeId}:${tree.persons.length}`).join(",")} truncated=${index.truncated}`
			);
			sendResponse({ ok: true, people });
		});
		return true;
	}

	if (type === "treeviz:ancestry-batch") {
		const batch = acceptBatch(body);
		if (!batch) {
			void appendLog(
				`${new Date().toISOString()} [background] ancestry batch rejected`
			);
			sendResponse({ ok: false });
			return false;
		}
		void openBatchPerson(batch).then(() => sendResponse({ ok: true }));
		return true;
	}

	if (type === "connector:update-treeviz") {
		void chrome.tabs
			.query({
				url: [
					"https://treeviz.com/*",
					"https://www.treeviz.com/*",
					"https://dev.treeviz.com/*",
					"https://qa.treeviz.com/*",
					"http://localhost/*",
				],
			})
			.then(async (tabs) => {
				let fallback: unknown = { ok: false, code: "closed" };
				for (const tab of tabs) {
					if (tab.id == null) {
						continue;
					}
					try {
						const response = await chrome.tabs.sendMessage(tab.id, body);
						const result = response as { ok?: boolean } | undefined;
						if (result?.ok) {
							sendResponse(result);
							return;
						}
						if (result) {
							fallback = result;
						}
					} catch {
						continue;
					}
				}
				sendResponse(fallback);
			});
		return true;
	}

	if (type === "connector:get-index") {
		void storageGet(chrome.storage.local, INDEX_KEY).then((value) =>
			sendResponse({ ok: true, index: asIndex(value) })
		);
		return true;
	}

	if (type === "connector:batch-for-page") {
		void storageGet(chrome.storage.session, BATCH_KEY).then((value) => {
			const batch = value as AncestryBatch | undefined;
			const person = batch?.people[batch.cursor];
			if (
				!batch ||
				!person ||
				person.treeId !== digits(body.treeId) ||
				person.personId !== digits(body.personId)
			) {
				sendResponse({ ok: true, person: undefined });
				return;
			}
			sendResponse({ ok: true, person });
		});
		return true;
	}

	if (type === "connector:batch-advance") {
		void storageGet(chrome.storage.session, BATCH_KEY).then(async (value) => {
			const batch = value as AncestryBatch | undefined;
			if (!batch) {
				sendResponse({ ok: false });
				return;
			}
			const extra = Array.isArray(body.errors) ? body.errors.map(String) : [];
			batch.errors.push(...extra);
			batch.cursor += 1;
			if (batch.cursor >= batch.people.length) {
				await storageRemove(chrome.storage.session, BATCH_KEY);
				sendResponse({ ok: true, done: true, errors: batch.errors });
				return;
			}
			await openBatchPerson(batch);
			sendResponse({ ok: true, done: false });
		});
		return true;
	}

	if (type === "connector:save-myheritage") {
		const tabId = sender.tab?.id;
		if (tabId == null) {
			sendResponse({ ok: false });
			return false;
		}
		void chrome.scripting
			.executeScript({
				target: { tabId },
				world: "MAIN",
				files: ["page/myheritage-save.js"],
			})
			.then(() => {
				void appendLog(
					`${new Date().toISOString()} [background] myheritage saveProfile injected tab=${tabId}`
				);
				sendResponse({ ok: true });
			})
			.catch((error: unknown) => {
				void appendLog(
					`${new Date().toISOString()} [background] myheritage inject failed ${error instanceof Error ? error.message : String(error)}`
				);
				sendResponse({ ok: false });
			});
		return true;
	}

	sendResponse({ ok: false });
	return false;
};

chrome.runtime.onMessage.addListener(onMessage);
chrome.runtime.onMessageExternal.addListener(onMessage);
