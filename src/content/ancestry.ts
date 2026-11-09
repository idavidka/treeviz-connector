import {
	ancestryLayoutKnown,
	checkAncestryFacts,
	readAncestryCards,
	writeAncestryFacts,
} from "../ancestry-writer.js";
import type { SiteFacts } from "../compare.js";
import { diffPerson, factTitleKey, foldName, sameName } from "../compare.js";
import { t } from "../i18n.js";
import { connectorLog } from "../log.js";
import { loadIndex, matchTrees, personIn, preferActive, ask } from "../match.js";
import { readLooseFacts } from "../page-facts.js";
import { parseAncestryLocation } from "../parse-url.js";
import { showPanel, patchPanel } from "../panel.js";
import type {
	AncestryBatchPerson,
	ConnectorFact,
	ConnectorPerson,
	ConnectorTree,
	FieldDiff,
	FieldKey,
} from "../protocol.js";

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

type SiteRelative = { name: string; sex?: "M" | "F" };

const pushRelative = (people: SiteRelative[], person: SiteRelative): void => {
	if (!person.name || person.name.length >= 80 || people.some((item) => item.name === person.name)) {
		return;
	}
	people.push(person);
};

const personCard = (anchor: HTMLElement): HTMLElement => {
	let node = anchor;
	while (node.parentElement) {
		const parent = node.parentElement;
		if (parent.querySelectorAll("a[href*='/person/']").length !== 1) {
			break;
		}
		if ((parent.innerText || "").length > 220) {
			break;
		}
		node = parent;
	}
	return node;
};

const sexOf = (anchor: HTMLElement): "M" | "F" | undefined => {
	const chunks: string[] = [];
	const card = personCard(anchor);
	card.querySelectorAll("*").forEach((node) => {
		for (const name of ["aria-label", "title", "alt", "src", "href", "class"]) {
			const value = (node as HTMLElement).getAttribute?.(name);
			if (value) {
				chunks.push(value);
			}
		}
		const image = getComputedStyle(node).backgroundImage;
		if (image && image !== "none") {
			chunks.push(image);
		}
	});
	const blob = chunks.join(" ").toLocaleLowerCase();
	const female =
		/\b(female|woman|weiblich|mujer|femme|nő|no)\b/.test(blob) ||
		/gender[_-]?f\b|silhouette[_-]f|_f_|\/f\//.test(blob);
	const male =
		/\b(male|man|männlich|hombre|homme|férfi|ferfi)\b/.test(blob) ||
		/gender[_-]?m\b|silhouette[_-]m|_m_|\/m\//.test(blob);
	if (female && !male) {
		return "F";
	}
	if (male && !female) {
		return "M";
	}
	return undefined;
};

const relativeFrom = (anchor: HTMLAnchorElement): SiteRelative => ({
	name: visibleName(anchor),
	sex: sexOf(anchor),
});

const namesAfter = (root: HTMLElement, start: HTMLElement, stop: string[]): SiteRelative[] => {
	const people: SiteRelative[] = [];
	for (const anchor of personAnchors(root, start, stop)) {
		pushRelative(people, relativeFrom(anchor));
	}
	return people;
};

const splitHousehold = (
	root: HTMLElement,
	start: HTMLElement
): { spouses: SiteRelative[]; children: SiteRelative[] } => {
	const anchors = personAnchors(root, start, []);
	const spouses: SiteRelative[] = [];
	const children: SiteRelative[] = [];
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
		pushRelative(lifespan || nested ? children : spouses, relativeFrom(anchor));
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

const linesAfter = (heading: HTMLElement, stop: string[]): SiteRelative[] => {
	const people: SiteRelative[] = [];
	for (const line of sectionLines(heading, stop)) {
		if (LIFESPAN.test(line)) {
			continue;
		}
		pushRelative(people, { name: cleanRelativeName(line) });
	}
	return people;
};

const splitLines = (lines: string[]): { spouses: SiteRelative[]; children: SiteRelative[] } => {
	const spouses: SiteRelative[] = [];
	const children: SiteRelative[] = [];
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
		pushRelative(next && LIFESPAN.test(next) ? children : spouses, { name });
	}
	return { spouses, children };
};

const SPOUSE_AND_CHILDREN = new Set([
	"spouse and children",
	"spouses and children",
	"spouse/partner and children",
	"spouses/partners and children",
	"házastárs és gyerekek",
	"házastársak és gyermekek",
	"házastárs és gyermekek",
]);
const SPOUSE_ONLY = new Set([
	"spouse",
	"spouses",
	"spouse/partner",
	"spouses/partners",
	"házastárs",
	"házastársak",
]);

const readFamilyLists = (
	root: HTMLElement
): { spouses: SiteRelative[]; children: SiteRelative[]; found: boolean } => {
	const spouses: SiteRelative[] = [];
	const children: SiteRelative[] = [];
	let found = false;
	root.querySelectorAll("h2, h3, h4").forEach((heading) => {
		const title = (heading.textContent || "").trim().toLocaleLowerCase();
		const withChildren = SPOUSE_AND_CHILDREN.has(title);
		const spousesOnly = SPOUSE_ONLY.has(title);
		if (!withChildren && !spousesOnly) {
			return;
		}
		const list = heading.nextElementSibling;
		if (!list || list.tagName !== "UL") {
			return;
		}
		found = true;
		Array.from(list.children).forEach((item) => {
			if (item.tagName !== "LI") {
				return;
			}
			const nested = Array.from(item.children).find((child) => child.tagName === "UL");
			const topLink = Array.from(item.querySelectorAll("a[href*='/person/']")).find(
				(anchor) => !nested || !nested.contains(anchor)
			) as HTMLAnchorElement | undefined;
			// A year range is on spouses and children alike. Indent (or a nested list)
			// marks the children under "Spouse and children". A "Spouse" heading is spouses only.
			const childRow =
				withChildren &&
				(item.classList.contains("researchListItemIndented") || Boolean(nested));
			if (topLink) {
				pushRelative(childRow && !nested ? children : spouses, relativeFrom(topLink));
			}
			if (withChildren && nested) {
				nested.querySelectorAll("a[href*='/person/']").forEach((anchor) => {
					pushRelative(children, relativeFrom(anchor as HTMLAnchorElement));
				});
			}
		});
	});
	return { spouses, children, found };
};

const readRelatives = (): {
	parents: SiteRelative[];
	spouses: SiteRelative[];
	children: SiteRelative[];
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
	const familyLists = readFamilyLists(root);
	const householdHeading = familyLists.found ? undefined : leafHeading(root, HOUSEHOLD_LABELS);
	const parents = parentsHeading ? namesAfter(root, parentsHeading, HOUSEHOLD_LABELS) : [];
	if (familyLists.found) {
		return {
			parents,
			spouses: familyLists.spouses,
			children: familyLists.children,
			parentsFound: Boolean(parentsHeading),
			householdFound: true,
		};
	}
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

const LIFE_FACT =
	/^(birth|szuletes|death|halal|marriage|hazassag|baptism|burial|christening|gender|sex|name|nev|nem)\b/;

const readPageFacts = (): ConnectorFact[] => {
	const facts: ConnectorFact[] = [];
	const seen = new Set<string>();
	const push = (title: string, value: string) => {
		const cleanTitle = title.trim();
		const cleanValue = value.trim();
		if (!cleanTitle || !cleanValue || LIFE_FACT.test(foldName(cleanTitle))) {
			return;
		}
		const id = `${factTitleKey(cleanTitle)}|${foldName(cleanValue)}`;
		if (seen.has(id)) {
			return;
		}
		seen.add(id);
		facts.push({ title: cleanTitle, value: cleanValue });
	};
	for (const card of readAncestryCards(document)) {
		push(card.title, [card.subtitle, card.date, card.place].filter(Boolean).join(", "));
	}
	for (const fact of readLooseFacts(document, relationshipsRoot())) {
		push(fact.title, fact.value);
	}
	return facts;
};

const factDiffs = (siteFacts: ConnectorFact[], treeFacts: ConnectorFact[]): FieldDiff[] => {
	const titles = new Map<string, string>();
	for (const fact of [...siteFacts, ...treeFacts]) {
		const key = factTitleKey(fact.title);
		if (key && !titles.has(key)) {
			titles.set(key, fact.title);
		}
	}
	const diffs: FieldDiff[] = [];
	for (const [key, title] of titles) {
		const siteValues = siteFacts
			.filter((fact) => factTitleKey(fact.title) === key)
			.map((fact) => fact.value);
		const treeValues = treeFacts
			.filter((fact) => factTitleKey(fact.title) === key)
			.map((fact) => fact.value);
		for (const value of siteValues) {
			if (treeValues.some((treeValue) => sameName(treeValue, value))) {
				continue;
			}
			diffs.push({ key: "fact", label: title, site: value, writable: false });
		}
		for (const value of treeValues) {
			if (siteValues.some((siteValue) => sameName(siteValue, value))) {
				continue;
			}
			diffs.push({ key: "fact", label: title, treeviz: value, writable: false });
		}
	}
	return diffs;
};

const treeRelatives = (tree: ConnectorTree, ids?: string[]): SiteRelative[] =>
	(ids ?? []).map((id) => {
		const found = personIn(tree, id);
		const sex = found?.sex === "M" || found?.sex === "F" ? found.sex : undefined;
		return { name: found?.name || id, sex };
	});

const sexWord = (sex?: "M" | "F"): string =>
	sex === "F" ? t("female") : sex === "M" ? t("male") : "";

const relativeDiff = (
	key: "parents" | "spouses" | "children",
	sitePeople: SiteRelative[],
	treePeople: SiteRelative[]
): FieldDiff | undefined => {
	const siteOnly = sitePeople.filter(
		(sitePerson) => !treePeople.some((treePerson) => sameName(treePerson.name, sitePerson.name))
	);
	const treeOnly = treePeople.filter(
		(treePerson) => !sitePeople.some((sitePerson) => sameName(sitePerson.name, treePerson.name))
	);
	const sexMismatch = sitePeople.filter((sitePerson) => {
		const match = treePeople.find((treePerson) => sameName(treePerson.name, sitePerson.name));
		return Boolean(match && sitePerson.sex && match.sex !== sitePerson.sex);
	});
	if (!siteOnly.length && !treeOnly.length && !sexMismatch.length) {
		return undefined;
	}
	const siteLabel = (person: SiteRelative): string =>
		person.sex ? `${person.name} (${sexWord(person.sex)})` : person.name;
	return {
		key,
		site: [...siteOnly, ...sexMismatch].map(siteLabel).join(", ") || undefined,
		treeviz: [...treeOnly.map((person) => person.name), ...sexMismatch.map((person) => person.name)].join(", ") || undefined,
		writable: false,
	};
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
	const pageFacts = readPageFacts();
	const factsKnown = Array.isArray(person.facts);
	const diffs = diffPerson(site, person, writableOnAncestry);
	if (factsKnown) {
		diffs.push(...factDiffs(pageFacts, person.facts ?? []));
	}
	const relativesKnown = Array.isArray(person.parentIds);
	if (relativesKnown && relatives.parentsFound) {
		const parentDiff = relativeDiff(
			"parents",
			relatives.parents,
			treeRelatives(tree, person.parentIds)
		);
		if (parentDiff) {
			diffs.push(parentDiff);
		}
	}
	if (relativesKnown && relatives.householdFound) {
		const spouseDiff = relativeDiff(
			"spouses",
			relatives.spouses,
			treeRelatives(tree, person.spouseIds)
		);
		const childDiff = relativeDiff(
			"children",
			relatives.children,
			treeRelatives(tree, person.childIds)
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
		pageFacts,
		factsKnown,
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
		relativesNote: [
			!relativesKnown && (relatives.parentsFound || relatives.householdFound)
				? t("relativesStale")
				: "",
			!factsKnown && pageFacts.length ? t("factsStale") : "",
		]
			.filter(Boolean)
			.join(" "),
		layoutKnown: site.layoutKnown,
		onUpdateSite: (diff) => {
			if (
				diff.key === "parents" ||
				diff.key === "spouses" ||
				diff.key === "children"
			) {
				patchPanel({ status: t("relativesNotWritten") });
				return;
			}
			if (diff.key === "fact") {
				patchPanel({ status: t("factNotWritten") });
				return;
			}
			if (!writableOnAncestry(diff.key)) {
				patchPanel({ status: t("layout") });
				return;
			}
			void writeSelected(person, site, [diff.key]);
		},
		onUpdateTree: (diff) => {
			patchPanel({ busy: true });
			const people =
				diff.key === "parents"
					? relatives.parents
					: diff.key === "spouses"
						? relatives.spouses
						: diff.key === "children"
							? relatives.children
							: undefined;
			void ask({
				type: "connector:update-treeviz",
				sourcePersonId: person.sourcePersonId,
				sourceTreeId: tree.sourceTreeId,
				key: diff.key,
				label: diff.label,
				site: diff.site,
				treeviz: diff.treeviz,
				people,
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
