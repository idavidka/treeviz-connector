import {
	ancestryLayoutKnown,
	checkAncestryFacts,
	readAncestryCards,
	writeAncestryFacts,
} from "../ancestry-writer.js";
import type { SiteFacts } from "../compare.js";
import { diffPerson } from "../compare.js";
import { t } from "../i18n.js";
import { connectorLog } from "../log.js";
import { loadIndex, matchTrees, personIn, preferActive, ask } from "../match.js";
import { parseAncestryLocation } from "../parse-url.js";
import { showPanel, patchPanel } from "../panel.js";
import type { AncestryBatchPerson, ConnectorPerson, ConnectorTree, FieldKey } from "../protocol.js";

const cardText = (
	cards: ReturnType<typeof readAncestryCards>,
	aliases: string[]
) => cards.find((card) => aliases.includes(card.title.toLocaleLowerCase()));

const valueUnderLabel = (labels: string[]): string | undefined => {
	let best: { length: number; value: string } | undefined;
	document.querySelectorAll("div, section, li, article").forEach((node) => {
		const text = (node as HTMLElement).innerText?.trim();
		if (!text || text.length > 90 || !text.includes("\n")) {
			return;
		}
		const lines = text
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean);
		if (lines.length < 2 || !labels.includes(lines[0].toLocaleLowerCase())) {
			return;
		}
		if (!best || text.length < best.length) {
			best = { length: text.length, value: lines.slice(1).join(", ") };
		}
	});
	return best?.value;
};

const splitFactLine = (value?: string): { date?: string; place?: string } => {
	if (!value) {
		return {};
	}
	if (/\d{3,4}/.test(value) && value.includes(",")) {
		const [date, ...rest] = value.split(",");
		return { date: date.trim(), place: rest.join(",").trim() };
	}
	if (/\d{3,4}/.test(value) || /unknown|ismeretlen/i.test(value)) {
		return { date: value };
	}
	return { place: value };
};

const siteFacts = (): SiteFacts => {
	const layoutKnown = ancestryLayoutKnown(document);
	const cards = readAncestryCards(document);
	const name = cardText(cards, ["name", "név", "nev", "nom", "nombre"]);
	const sex = cardText(cards, ["gender", "nem", "geschlecht", "sexe", "sexo"]);
	const birth = cardText(cards, ["birth", "születés", "szuletes", "geburt", "naissance", "nacimiento"]);
	const death = cardText(cards, ["death", "halál", "halal", "tod", "décès", "deces", "defunción"]);
	const marriage = cardText(cards, ["marriage", "házasság", "hazassag", "heirat", "mariage", "matrimonio"]);
	const looseBirth = splitFactLine(
		valueUnderLabel(["birth", "születés", "szuletes", "geburt", "naissance", "nacimiento"])
	);
	const looseDeath = splitFactLine(
		valueUnderLabel(["death", "halál", "halal", "tod", "décès", "deces", "defunción"])
	);
	const looseMarriage = splitFactLine(
		valueUnderLabel(["marriage", "házasság", "hazassag", "heirat", "mariage", "matrimonio"])
	);
	return {
		layoutKnown,
		name: name?.subtitle || valueUnderLabel(["name", "név", "nev", "nom", "nombre"]),
		sex: sex?.subtitle || valueUnderLabel(["gender", "sex", "nem", "geschlecht", "sexe", "sexo"]),
		birthDate: birth?.date || looseBirth.date,
		birthPlace: birth?.place || looseBirth.place,
		deathDate: death?.date || looseDeath.date,
		deathPlace: death?.place || looseDeath.place,
		marriageDate: marriage?.date || looseMarriage.date,
		marriagePlace: marriage?.place || looseMarriage.place,
	};
};

const writableOnAncestry = (key: FieldKey): boolean =>
	ancestryLayoutKnown(document) &&
	(key === "birthDate" ||
		key === "birthPlace" ||
		key === "deathDate" ||
		key === "deathPlace" ||
		key === "marriageDate" ||
		key === "marriagePlace");

const factType = (key: FieldKey): string => {
	if (key.startsWith("birth")) return "Birth";
	if (key.startsWith("death")) return "Death";
	return "Marriage";
};

const writeSelected = async (
	person: ConnectorPerson,
	site: SiteFacts,
	keys: FieldKey[]
): Promise<void> => {
	if (!navigator.onLine) {
		patchPanel({ status: t("offline") });
		return;
	}
	const facts = keys
		.filter(writableOnAncestry)
		.map((key) => {
			const kind = key.endsWith("Date") ? "date" : "place";
			const fromDate = kind === "date" ? siteValue(site, key) : dateSibling(site, key);
			const fromPlace = kind === "place" ? siteValue(site, key) : placeSibling(site, key);
			const toDate = kind === "date" ? treeValue(person, key) : dateSiblingTree(person, key);
			const toPlace = kind === "place" ? treeValue(person, key) : placeSiblingTree(person, key);
			return {
				type: factType(key),
				from: { date: fromDate, place: fromPlace },
				to: { date: toDate, place: toPlace },
			};
		});
	const merged = new Map<string, (typeof facts)[number]>();
	for (const fact of facts) {
		const existing = merged.get(fact.type);
		if (!existing) {
			merged.set(fact.type, fact);
			continue;
		}
		existing.to.date = fact.to.date || existing.to.date;
		existing.to.place = fact.to.place || existing.to.place;
		existing.from.date = fact.from.date || existing.from.date;
		existing.from.place = fact.from.place || existing.from.place;
	}
	patchPanel({ busy: true, status: t("update") });
	connectorLog("ancestry", "write start", [...merged.values()]);
	const errors = await writeAncestryFacts([...merged.values()]);
	connectorLog("ancestry", "write done", errors);
	patchPanel({
		busy: false,
		status: errors.length ? `${t("failed")} ${errors.join(", ")}` : t("wrote"),
	});
};

const siteValue = (site: SiteFacts, key: FieldKey): string | undefined => site[key];
const treeValue = (person: ConnectorPerson, key: FieldKey): string | undefined =>
	person[key as keyof ConnectorPerson] as string | undefined;

const dateSibling = (site: SiteFacts, key: FieldKey): string | undefined => {
	if (key.startsWith("birth")) return site.birthDate;
	if (key.startsWith("death")) return site.deathDate;
	return site.marriageDate;
};
const placeSibling = (site: SiteFacts, key: FieldKey): string | undefined => {
	if (key.startsWith("birth")) return site.birthPlace;
	if (key.startsWith("death")) return site.deathPlace;
	return site.marriagePlace;
};
const dateSiblingTree = (person: ConnectorPerson, key: FieldKey): string | undefined => {
	if (key.startsWith("birth")) return person.birthDate;
	if (key.startsWith("death")) return person.deathDate;
	return person.marriageDate;
};
const placeSiblingTree = (person: ConnectorPerson, key: FieldKey): string | undefined => {
	if (key.startsWith("birth")) return person.birthPlace;
	if (key.startsWith("death")) return person.deathPlace;
	return person.marriagePlace;
};

const showTree = (tree: ConnectorTree, personId: string, cachedAt?: number): void => {
	const person = personIn(tree, personId);
	if (!person) {
		showPanel({ heading: t("title"), detail: t("notInTree"), cachedAt });
		return;
	}
	const site = siteFacts();
	const diffs = diffPerson(site, person, writableOnAncestry);
	connectorLog("ancestry", "compare", {
		tree: tree.name,
		treeId: tree.sourceTreeId,
		personId,
		layout: site.layoutKnown,
		facts: Boolean(document.querySelector("#researchListFacts")),
		edit: Boolean(document.querySelector("#FactEditComponent")),
		diffs: diffs.map((diff) => ({
			key: diff.key,
			site: diff.site,
			treeviz: diff.treeviz,
			writable: diff.writable,
		})),
	});
	showPanel({
		heading: t("title"),
		detail: t("inTree", { tree: tree.name }),
		cachedAt,
		diffs,
		layoutKnown: site.layoutKnown,
		onWrite: (keys) => {
			void writeSelected(person, site, keys);
		},
	});
};

const renderMatch = async (): Promise<void> => {
	const location = parseAncestryLocation(window.location.href);
	if (!location) {
		connectorLog("ancestry", "url is not a person page", window.location.href);
		return;
	}
	const index = await loadIndex();
	connectorLog("ancestry", "page", {
		href: window.location.href,
		treeId: location.treeId,
		personId: location.personId,
		index: Boolean(index),
		publishedAt: index?.publishedAt,
		trees: index?.trees.map((tree) => ({
			source: tree.source,
			id: tree.sourceTreeId,
			people: tree.persons.length,
			active: tree.active,
		})),
	});
	if (!index) {
		connectorLog("ancestry", "no TreeViz index in this browser");
		showPanel({ heading: t("title"), detail: t("signIn") });
		return;
	}
	const trees = matchTrees(index, "ancestry", location.treeId, location.personId);
	if (!trees.length) {
		connectorLog("ancestry", "no matching tree");
		showPanel({
			heading: t("title"),
			detail: t("notInTree"),
			cachedAt: index.publishedAt,
		});
		return;
	}
	const preferred = preferActive(trees);
	if (!preferred) {
		showPanel({
			heading: t("title"),
			detail: t("pickTree"),
			cachedAt: index.publishedAt,
			trees,
			onPickTree: (tree) => showTree(tree, location.personId, index.publishedAt),
		});
		return;
	}
	showTree(preferred, location.personId, index.publishedAt);
};

let batchRunning = false;

const runBatch = async (): Promise<void> => {
	if (batchRunning) {
		return;
	}
	batchRunning = true;
	try {
		await runBatchOnce();
	} finally {
		batchRunning = false;
	}
};

const runBatchOnce = async (): Promise<void> => {
	const location = parseAncestryLocation(window.location.href);
	if (!location) {
		return;
	}
	const response = await ask({
		type: "connector:batch-for-page",
		treeId: location.treeId,
		personId: location.personId,
	});
	const person = response.person as AncestryBatchPerson | undefined;
	if (!person) {
		return;
	}
	connectorLog("ancestry", "batch person", {
		treeId: person.treeId,
		personId: person.personId,
		facts: person.facts.length,
	});
	if (!ancestryLayoutKnown(document)) {
		await ask({
			type: "connector:batch-advance",
			errors: [`${person.personId}: layout`],
		});
		return;
	}
	const missing = checkAncestryFacts(person.facts);
	if (missing.length) {
		showPanel({
			heading: t("title"),
			detail: t("missingFact"),
			status: missing.join(", "),
		});
		await ask({
			type: "connector:batch-advance",
			errors: missing.map((type) => `${person.personId} ${type}`),
		});
		return;
	}
	const errors = await writeAncestryFacts(person.facts);
	connectorLog("ancestry", "batch write", errors);
	const next = await ask({ type: "connector:batch-advance", errors });
	if (next.done) {
		const all = (next.errors as string[] | undefined) ?? errors;
		showPanel({
			heading: t("title"),
			detail: t("batchDone"),
			status: all.length ? all.join("; ") : t("wrote"),
		});
	}
	};

let href = "";
const tick = (): void => {
	if (window.location.href === href) {
		return;
	}
	href = window.location.href;
	void renderMatch().then(() => runBatch());
};

chrome.runtime.onMessage.addListener((message) => {
	const body = message as { type?: string };
	if (body?.type === "connector:run-batch") {
		void runBatch();
	}
});

tick();
window.setInterval(tick, 1000);
