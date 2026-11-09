import {
	ancestryLayoutKnown,
	checkAncestryFacts,
	readAncestryCards,
	writeAncestryFacts,
} from "../ancestry-writer.js";
import type { SiteFacts } from "../compare.js";
import { diffNameList, diffPerson } from "../compare.js";
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

const siteValue = (site: SiteFacts, key: FieldKey): string | undefined => {
	const value = site[key as keyof SiteFacts];
	return typeof value === "string" ? value : undefined;
};
const treeValue = (person: ConnectorPerson, key: FieldKey): string | undefined => {
	const value = person[key as keyof ConnectorPerson];
	return typeof value === "string" ? value : undefined;
};

const leafHeading = (root: ParentNode, labels: string[]): HTMLElement | undefined => {
	let found: HTMLElement | undefined;
	root.querySelectorAll("h1,h2,h3,h4,h5,div,span,p").forEach((node) => {
		const el = node as HTMLElement;
		const text = el.innerText?.trim() ?? "";
		if (!labels.includes(text.toLocaleLowerCase()) || text.length > 40) {
			return;
		}
		if (!found || el.innerText.length < found.innerText.length) {
			found = el;
		}
	});
	return found;
};

const relationshipsRoot = (): HTMLElement | undefined => {
	const heading = leafHeading(document, [
		"relationships",
		"kapcsolatok",
		"verwandtschaft",
		"relations",
		"relazioni",
		"relaciones",
	]);
	let node = heading?.parentElement;
	while (node && node !== document.body) {
		const text = node.innerText?.toLocaleLowerCase() ?? "";
		if (text.includes("parents") || text.includes("szülők") || text.includes("szulok")) {
			return node;
		}
		node = node.parentElement;
	}
	return undefined;
};

const cleanRelativeName = (value: string): string =>
	value
		.split("\n")[0]
		.trim()
		.replace(/^(?:edit|szerkesztés|szerkesztes|bearbeiten|modifier|modifica|editar)(?=\p{Lu})/iu, "")
		.replace(/\s*\d{3,4}\s*[–—-].*$/, "")
		.replace(/\d{3,4}\s*[–—-].*$/, "")
		.replace(/\s*\(\d{3,4}[^)]*\)\s*$/, "")
		.trim();

const ACTION_LABEL =
	/^(edit|szerkesztés|szerkesztes|bearbeiten|modifier|modifica|editar|view|megtekintés)$/i;

const visibleName = (anchor: HTMLElement): string => {
	const parts: string[] = [];
	const walker = document.createTreeWalker(anchor, NodeFilter.SHOW_TEXT);
	let node = walker.nextNode();
	while (node) {
		const parent = (node as Text).parentElement;
		if (parent?.closest("button, [role='button']")) {
			node = walker.nextNode();
			continue;
		}
		const text = node.textContent?.replace(/\s+/g, " ").trim() ?? "";
		if (text && !ACTION_LABEL.test(text) && !LIFESPAN.test(text)) {
			parts.push(text);
		}
		node = walker.nextNode();
	}
	return cleanRelativeName(parts.join(" ") || anchor.textContent || "");
};

const LIFESPAN =
	/^(abt\.?|about|ca\.?|c\.|cir\.?|circa|bef\.?|before|aft\.?|after|est\.?|cal\.?)?\s*\d{3,4}(\s*[–—-]\s*(\d{3,4})?)?$/i;

const personAnchors = (root: HTMLElement, start: HTMLElement, stop: string[]): HTMLAnchorElement[] => {
	const found: HTMLAnchorElement[] = [];
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
	walker.currentNode = start;
	let node = walker.nextNode();
	while (node) {
		const el = node as HTMLElement;
		const text = (el.innerText || "").trim();
		const first = text.split("\n")[0]?.trim().toLocaleLowerCase() ?? "";
		if (text.length < 80 && stop.includes(first)) {
			break;
		}
		const href = el.getAttribute("href") || "";
		if (el instanceof HTMLAnchorElement && /\/person\/\d+/.test(href)) {
			found.push(el);
		}
		node = walker.nextNode();
	}
	return found;
};

const cardLines = (el: HTMLElement): string[] => {
	let node = el;
	while (node.parentElement) {
		const parent = node.parentElement;
		const links = parent.querySelectorAll("a[href*='/person/']");
		if (links.length !== 1 || (parent.innerText || "").length > 140) {
			break;
		}
		node = parent;
	}
	return (node.innerText || "")
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
};

const pushName = (names: string[], value: string): void => {
	const name = cleanRelativeName(value);
	if (name && name.length < 80 && !names.includes(name)) {
		names.push(name);
	}
};

const namesAfter = (root: HTMLElement, start: HTMLElement, stop: string[]): string[] => {
	const names: string[] = [];
	for (const anchor of personAnchors(root, start, stop)) {
		pushName(names, visibleName(anchor));
	}
	return names;
};

const splitHousehold = (
	root: HTMLElement,
	start: HTMLElement
): { spouses: string[]; children: string[] } => {
	const anchors = personAnchors(root, start, []);
	const spouses: string[] = [];
	const children: string[] = [];
	for (const anchor of anchors) {
		const lines = cardLines(anchor);
		const lifespan = lines.slice(1).some((line) => LIFESPAN.test(line));
		let nested = false;
		let node = anchor.parentElement;
		while (node && node !== root) {
			const inside = anchors.filter((item) => node?.contains(item));
			const firstLine = cleanRelativeName((node.innerText || "").split("\n")[0] || "");
			const firstName = inside[0] ? visibleName(inside[0]) : "";
			if (inside.length > 1 && inside[0] !== anchor && firstLine && firstLine === firstName) {
				nested = true;
				break;
			}
			node = node.parentElement;
		}
		pushName(lifespan || nested ? children : spouses, visibleName(anchor));
	}
	return { spouses, children };
};

const PARENT_LABELS = ["parents", "szülők", "szulok", "eltern", "parents", "genitori", "padres"];
const HOUSEHOLD_LABELS = [
	"spouse and children",
	"spouses and children",
	"spouse",
	"házastárs és gyerekek",
	"házastársak és gyermekek",
	"házastárs és gyermekek",
	"ehepartner und kinder",
	"conjoint et enfants",
	"coniuge e figli",
	"cónyuge e hijos",
];

const sectionLines = (heading: HTMLElement, stop: string[]): string[] => {
	const lines = (heading.parentElement?.innerText || "")
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
	const label = heading.innerText.trim().toLocaleLowerCase();
	const start = lines.findIndex((line) => line.toLocaleLowerCase() === label);
	const kept: string[] = [];
	for (const line of lines.slice(start + 1)) {
		const key = line.toLocaleLowerCase();
		if (stop.includes(key)) {
			break;
		}
		if (
			/^(add|search)\b/i.test(line) ||
			/hozzáad|hozzaad/i.test(line) ||
			ACTION_LABEL.test(line) ||
			line.length > 60
		) {
			continue;
		}
		kept.push(line);
	}
	return kept;
};

const linesAfter = (heading: HTMLElement, stop: string[]): string[] => {
	const names: string[] = [];
	for (const line of sectionLines(heading, stop)) {
		if (LIFESPAN.test(line)) {
			continue;
		}
		pushName(names, line);
	}
	return names;
};

const splitLines = (lines: string[]): { spouses: string[]; children: string[] } => {
	const spouses: string[] = [];
	const children: string[] = [];
	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		if (LIFESPAN.test(line)) {
			continue;
		}
		const name = cleanRelativeName(line);
		if (!name) {
			continue;
		}
		const next = lines[index + 1];
		pushName(next && LIFESPAN.test(next) ? children : spouses, name);
	}
	return { spouses, children };
};

const readRelatives = (): {
	parents: string[];
	spouses: string[];
	children: string[];
	parentsFound: boolean;
	householdFound: boolean;
} => {
	const empty = {
		parents: [],
		spouses: [],
		children: [],
		parentsFound: false,
		householdFound: false,
	};
	const root = relationshipsRoot();
	if (!root) {
		return empty;
	}
	const parentsHeading = leafHeading(root, PARENT_LABELS);
	const householdHeading = leafHeading(root, HOUSEHOLD_LABELS);
	const parents = parentsHeading ? namesAfter(root, parentsHeading, HOUSEHOLD_LABELS) : [];
	const linked = householdHeading ? splitHousehold(root, householdHeading) : { spouses: [], children: [] };
	const fromLines =
		householdHeading && !linked.spouses.length && !linked.children.length
			? splitLines(sectionLines(householdHeading, []))
			: linked;
	return {
		parents:
			parents.length || !parentsHeading ? parents : linesAfter(parentsHeading, HOUSEHOLD_LABELS),
		spouses: fromLines.spouses,
		children: fromLines.children,
		parentsFound: Boolean(parentsHeading),
		householdFound: Boolean(householdHeading),
	};
};

const namesFor = (tree: ConnectorTree, ids?: string[]): string[] => {
	if (!ids) {
		return [];
	}
	return ids.map((id) => personIn(tree, id)?.name || id);
};

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
	const relatives = readRelatives();
	const diffs = diffPerson(site, person, writableOnAncestry);
	const relativesKnown = Array.isArray(person.parentIds);
	if (relativesKnown && relatives.parentsFound) {
		const parentDiff = diffNameList(
			"parents",
			relatives.parents,
			namesFor(tree, person.parentIds)
		);
		if (parentDiff) {
			diffs.push(parentDiff);
		}
	}
	if (relativesKnown && relatives.householdFound) {
		const spouseDiff = diffNameList(
			"spouses",
			relatives.spouses,
			namesFor(tree, person.spouseIds)
		);
		const childDiff = diffNameList(
			"children",
			relatives.children,
			namesFor(tree, person.childIds)
		);
		if (spouseDiff) {
			diffs.push(spouseDiff);
		}
		if (childDiff) {
			diffs.push(childDiff);
		}
	}
	connectorLog("ancestry", "compare", {
		tree: tree.name,
		treeId: tree.sourceTreeId,
		personId,
		layout: site.layoutKnown,
		facts: Boolean(document.querySelector("#researchListFacts")),
		edit: Boolean(document.querySelector("#FactEditComponent")),
		relatives,
		relativesKnown,
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
		relativesNote:
			!relativesKnown && (relatives.parentsFound || relatives.householdFound)
				? t("relativesStale")
				: undefined,
		layoutKnown: site.layoutKnown,
		onUpdateSite: (key) => {
			if (key === "parents" || key === "spouses" || key === "children") {
				patchPanel({ status: t("relativesNotWritten") });
				return;
			}
			if (!writableOnAncestry(key)) {
				patchPanel({ status: t("layout") });
				return;
			}
			void writeSelected(person, site, [key]);
		},
		onUpdateTree: (key) => {
			const diff = diffs.find((item) => item.key === key);
			patchPanel({ busy: true });
			void ask({
				type: "connector:update-treeviz",
				sourcePersonId: person.sourcePersonId,
				sourceTreeId: tree.sourceTreeId,
				key,
				site: diff?.site,
				treeviz: diff?.treeviz,
			}).then((response) => {
				const code = String(response.code ?? "");
				const names = String(response.names ?? "");
				const statusText =
					code === "added"
						? t("addedRelatives", { names })
						: code === "fact"
							? t("updatedTree")
							: code === "nothing"
								? t("nothingToAdd")
								: code === "ambiguous"
									? t("ambiguous", { names })
									: t("treeClosed");
				patchPanel({ busy: false, status: statusText });
			});
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
