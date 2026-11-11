import {
	diffFactValues,
	diffNameList,
	diffPerson,
	collapse,
	factDatePhrase,
	factTitleKey,
	foldName,
	parseLooseDate,
	samePersonName,
	splitFactValue,
	splitPersonName,
	splitWebLink,
} from "../compare.js";
import type { SiteFacts } from "../compare.js";
import { languageReady, onLanguage, t } from "../i18n.js";
import { connectorLog } from "../log.js";
import { ask, loadIndex, matchTrees, personIn, preferActive } from "../match.js";
import { parseMyHeritageLocation } from "../parse-url.js";
import { showPanel, patchPanel } from "../panel.js";
import { formatProbe, htmlSkeleton, type ProbeLine } from "../probe.js";
import type { ConnectorFact, ConnectorPerson, ConnectorTree, FieldDiff, FieldKey } from "../protocol.js";

type WriteField = { id: string; value?: string; check?: boolean };

const editorDocuments = (): Document[] => {
	const docs = [document];
	const visit = (doc: Document): void => {
		for (const frame of Array.from(doc.querySelectorAll("iframe"))) {
			try {
				const child = frame.contentDocument;
				if (child && !docs.includes(child)) {
					docs.push(child);
					visit(child);
				}
			} catch {
				// A cross-origin frame is not the editor.
			}
		}
	};
	visit(document);
	return docs;
};

const activeForm = (): HTMLFormElement | null => {
	for (const doc of editorDocuments()) {
		const named = doc.getElementById("editProfileForm");
		if (named instanceof HTMLFormElement) {
			return named;
		}
		const firstName =
			doc.getElementById("firstName") || doc.querySelector("[name='firstName']");
		const form = firstName?.closest("form");
		if (form instanceof HTMLFormElement) {
			return form;
		}
	}
	return null;
};

const valueOf = (id: string, root: ParentNode = document): string => {
	const node =
		root.querySelector(`#${CSS.escape(id)}`) ||
		root.querySelector(`[name="${CSS.escape(id)}"]`);
	if (
		node instanceof HTMLInputElement ||
		node instanceof HTMLSelectElement ||
		node instanceof HTMLTextAreaElement
	) {
		return node.value || "";
	}
	return "";
};

const onEditorPage = (): boolean => /edit-profile\.php/i.test(window.location.pathname);

const urlPersonId = (): string =>
	parseMyHeritageLocation(window.location.href)?.personId?.replace(/[^\d]/g, "") || "";

const composedDate = (prefix: string, root: ParentNode = document): string => {
	const year = valueOf(`gdp_firstDateYear_${prefix}`, root);
	const month = valueOf(`gdp_firstDateMonth_${prefix}`, root);
	const day = valueOf(`gdp_firstDateDay_${prefix}`, root);
	if (!year || year.toLocaleLowerCase() === "év" || !/^\d{4}$/.test(year)) {
		return "";
	}
	const monthNumber = Number(month);
	const dayNumber = Number(day);
	if (monthNumber >= 1 && dayNumber >= 1) {
		return `${dayNumber} ${monthNumber} ${year}`;
	}
	if (monthNumber >= 1) {
		return `${monthNumber} ${year}`;
	}
	return year;
};

const checkedSex = (form: ParentNode): string => {
	const selected = form.querySelector('input[name="gender"]:checked');
	return selected instanceof HTMLInputElement ? selected.value : "";
};

const readForm = (): SiteFacts | undefined => {
	const form = activeForm();
	if (!form) {
		return undefined;
	}
	const individual = valueOf("individualID", form) || urlPersonId();
	if (!individual) {
		return undefined;
	}
	return {
		layoutKnown: true,
		name: `${valueOf("firstName", form)} ${valueOf("lastName", form)}`.trim(),
		sex: checkedSex(form),
		birthDate: composedDate("birthDate", form),
		birthPlace: valueOf("birthPlace", form),
		deathDate: composedDate("deathDate", form),
		deathPlace: valueOf("deathPlace", form),
		marriageDate: composedDate("marriageDate0", form),
		marriagePlace: valueOf("marriagePlace0", form),
	};
};

const formPersonId = (): string => {
	const form = activeForm();
	const field = form ? valueOf("individualID", form) : "";
	return field.replace(/[^\d]/g, "") || urlPersonId();
};

const fieldByTitle = new Map<string, string>();

const editorStep = (): string => {
	try {
		return new URL(window.location.href).searchParams.get("step") || "essentials";
	} catch {
		return "essentials";
	}
};

const namedControl = (
	form: ParentNode,
	name: string
): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null => {
	const node = form.querySelector(`[name="${CSS.escape(name)}"]`);
	if (
		node instanceof HTMLInputElement ||
		node instanceof HTMLTextAreaElement ||
		node instanceof HTMLSelectElement
	) {
		return node;
	}
	return null;
};

const controlValue = (form: ParentNode, name: string): string =>
	namedControl(form, name)?.value.trim() || "";

const joinParts = (parts: Array<string | undefined>): string =>
	parts.map((part) => part?.trim() || "").filter(Boolean).join(", ");

const pushFact = (
	facts: ConnectorFact[],
	title: string,
	value: string,
	field?: string
): void => {
	if (field) {
		fieldByTitle.set(factTitleKey(title), field);
	}
	const clean = value.trim();
	if (!title || !clean || clean === "Y") {
		return;
	}
	facts.push({ title, value: clean });
};

const eachPresent = (
	form: ParentNode,
	base: string,
	visit: (index: string) => void
): void => {
	for (let index = 0; index < 30; index += 1) {
		if (!namedControl(form, `${base}${index}`)) {
			break;
		}
		visit(String(index));
	}
};

const FACT_TYPE_TITLE: Record<string, string> = {
	BIRT: "Birth",
	DEAT: "Death",
	MARR: "Marriage",
	OCCU: "Occupation",
	EDUC: "Education",
	RELI: "Religion",
	BURI: "Burial",
	CHR: "Christening",
	BAPM: "Baptism",
	RESI: "Residence",
	NATI: "Nationality",
	TITL: "Title",
	ADDR: "Address",
};

const FAVORITE_FIELDS: Array<[string, string]> = [
	["favoriteInterestsHeader", "Interests"],
	["favoriteActivitiesHeader", "Activities"],
	["favoriteMusicHeader", "Music"],
	["favoriteMoviesHeader", "Movies"],
	["favoriteTVShowsHeader", "TV shows"],
	["favoriteBooksHeader", "Books"],
	["favoriteSportsHeader", "Sports"],
	["favoriteRestaurantsHeader", "Restaurants"],
	["favoriteFoodHeader", "Food"],
	["favoritePeopleHeader", "People"],
	["favoriteGetawaysHeader", "Getaways"],
	["favoriteQuotesHeader", "Quotes"],
];

const readEditorSections = (
	form: ParentNode,
	step: string
): { facts: ConnectorFact[]; relatives: Record<"parents" | "spouses" | "children", string[]> } => {
	fieldByTitle.clear();
	const facts: ConnectorFact[] = [];
	const relatives = { parents: [] as string[], spouses: [] as string[], children: [] as string[] };
	const single: Array<[string, string]> = [
		["nickname", "Nickname"],
		["formerName", "Former name"],
		["marriedName", "Married name"],
		["prefix", "Prefix"],
		["suffix", "Suffix"],
		["religiousName", "Religious name"],
		["godparents", "Godparents"],
		["causeOfDeath", "Cause of Death"],
		["religion", "Religion"],
		["nationalitiesHeader", "Nationality"],
		["languages", "Language"],
		["politicsHeader", "Political"],
		["height", "Height"],
		["weight", "Weight"],
		["hairColor", "Hair color"],
		["eyeColor", "Eye color"],
		["physical", "Physical description"],
		["biography", "Biography"],
		["biographyText", "Biography"],
	];
	for (const [name, title] of single) {
		if (namedControl(form, name)) {
			pushFact(facts, title, controlValue(form, name), name);
		}
	}
	pushFact(
		facts,
		"Christening",
		joinParts([composedDate("christeningDate", form), controlValue(form, "christeningPlace")]),
		namedControl(form, "christeningPlace") ? "christeningPlace" : undefined
	);
	pushFact(
		facts,
		"Burial",
		joinParts([composedDate("burialDate", form), controlValue(form, "burialPlace")]),
		namedControl(form, "burialPlace") ? "burialPlace" : undefined
	);
	eachPresent(form, "addressAddressOne", (index) => {
		pushFact(
			facts,
			"Address",
			joinParts([
				controlValue(form, `addressAddressOne${index}`),
				controlValue(form, `addressAddressTwo${index}`),
				controlValue(form, `addressCity${index}`),
				controlValue(form, `addressZip${index}`),
				controlValue(form, `addressCountry${index}`),
				composedDate(`addressDate${index}`, form),
			]),
			`addressAddressOne${index}`
		);
	});
	eachPresent(form, "contactEmail", (index) => {
		pushFact(facts, "Email", controlValue(form, `contactEmail${index}`), `contactEmail${index}`);
	});
	eachPresent(form, "contactPhone", (index) => {
		pushFact(facts, "Phone", controlValue(form, `contactPhone${index}`), `contactPhone${index}`);
	});
	eachPresent(form, "contactFax", (index) => {
		pushFact(facts, "Fax", controlValue(form, `contactFax${index}`), `contactFax${index}`);
	});
	eachPresent(form, "contactWebAddress", (index) => {
		pushFact(
			facts,
			"Web Address",
			joinParts([
				controlValue(form, `contactWebUsername${index}`),
				controlValue(form, `contactWebAddress${index}`),
			]),
			`contactWebAddress${index}`
		);
	});
	eachPresent(form, "workHeader", (index) => {
		pushFact(
			facts,
			"Occupation",
			joinParts([
				controlValue(form, `workHeader${index}`),
				controlValue(form, `workPlace${index}`),
				controlValue(form, `workNote${index}`),
				composedDate(`workDate${index}`, form),
			]),
			`workHeader${index}`
		);
	});
	eachPresent(form, "educationHeader", (index) => {
		pushFact(
			facts,
			"Education",
			joinParts([
				controlValue(form, `educationHeader${index}`),
				controlValue(form, `educationPlace${index}`),
				controlValue(form, `educationNote${index}`),
				composedDate(`educationDate${index}`, form),
			]),
			`educationHeader${index}`
		);
	});
	for (const [name, title] of FAVORITE_FIELDS) {
		pushFact(facts, title, controlValue(form, name), name);
	}
	eachPresent(form, "citationSource", (index) => {
		const source = controlValue(form, `citationSource${index}`);
		const description = controlValue(form, `citationDescription${index}`);
		const page = controlValue(form, `citationPage${index}`);
		const date = composedDate(`citationDate${index}`, form);
		const chosen = [source, description, page, date].filter(
			(part) => part && !/^-?\d+$/.test(part)
		);
		pushFact(facts, "Citation", chosen.join(", "), `citationDescription${index}`);
	});
	if (step === "family") {
		form.querySelectorAll("input[name], textarea[name]").forEach((node) => {
			const name = node.getAttribute("name") || "";
			if (/^marriage.*(note|description|header|comment)/i.test(name)) {
				pushFact(facts, "Marriage", controlValue(form, name), name);
			}
		});
	}
	eachPresent(form, "factType", (index) => {
		const type = controlValue(form, `factType${index}`);
		const title = FACT_TYPE_TITLE[type] || type;
		if (type === "DEAT") {
			pushFact(
				facts,
				"Cause of Death",
				controlValue(form, `causeOfDeath${index}`),
				`causeOfDeath${index}`
			);
		}
		if (title === "Birth" || title === "Death" || title === "Marriage") {
			pushFact(facts, title, controlValue(form, `factHeader${index}`), `factHeader${index}`);
			return;
		}
		if (namedControl(form, `factHeader${index}`) || namedControl(form, `factPlace${index}`)) {
			pushFact(
				facts,
				title,
				joinParts([
					controlValue(form, `factHeader${index}`),
					controlValue(form, `factPlace${index}`),
					composedDate(`factDate${index}`, form),
				]),
				`factHeader${index}`
			);
		}
	});
	if (step === "biography") {
		const area = form.querySelector("textarea");
		if (area instanceof HTMLTextAreaElement && area.name) {
			pushFact(facts, "Biography", area.value, area.name);
		}
	}
	if (step === "family") {
		const anchors = Array.from(form.querySelectorAll("a[name^='parents'], a[name^='spouse']"));
		for (const label of Array.from(form.querySelectorAll(".FL_Label"))) {
			const role = label.nextElementSibling;
			if (!(role instanceof Element) || !role.classList.contains("FL_LabelDimmed")) {
				continue;
			}
			const name = label.textContent?.replace(/\s+/g, " ").trim() || "";
			const folded = name
				.normalize("NFD")
				.replace(/\p{Diacritic}/gu, "")
				.toLocaleLowerCase();
			if (!name || name.length > 80 || /betoltes folyamatban|^loading\b|^tipp:/.test(folded)) {
				continue;
			}
			const roleText = (role.textContent || "")
				.normalize("NFD")
				.replace(/\p{Diacritic}/gu, "")
				.toLocaleLowerCase();
			const roleKind = /father|mother|parent|apa|anya|apja|anyja|vater|mutter|pere|mere|padre|madre/.test(
				roleText
			)
				? "parents"
				: /husband|wife|spouse|partner|ferj|feleseg|hazastars|gatte|epoux|ehepartner|esposo|conyuge/.test(
						roleText
					)
					? "spouses"
					: undefined;
			let kind: "parents" | "spouses" = roleKind ?? "parents";
			if (!roleKind) {
				for (const anchor of anchors) {
					if (anchor.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING) {
						const marker = anchor.getAttribute("name") || "";
						kind = marker.startsWith("spouse") ? "spouses" : "parents";
					}
				}
			}
			relatives[kind].push(name);
		}
	}
	return { facts, relatives };
};

const factListDiffs = (siteFacts: ConnectorFact[], treeFacts: ConnectorFact[]): FieldDiff[] =>
	diffFactValues(siteFacts, treeFacts, true);

const writable = (_key: FieldKey): boolean => true;

const dateFields = (prefix: string, raw?: string): WriteField[] => {
	const parsed = parseLooseDate(raw);
	if (!parsed) {
		return [];
	}
	const qualifier = qualifierOf(raw);
	const fields: WriteField[] = [
		{ id: `gdp_firstDateYear_${prefix}`, value: String(parsed.y) },
		{ id: `gdp_firstDateMonth_${prefix}`, value: parsed.m ? String(parsed.m) : "0" },
		{ id: `gdp_firstDateDay_${prefix}`, value: parsed.d ? String(parsed.d) : "0" },
		{ id: `gdp_dateType_${prefix}`, value: qualifier },
		{ id: `gdp_firstOperatorType_${prefix}`, value: qualifier },
	];
	return fields;
};

const factRow = (type: string): string | undefined => {
	const form = activeForm() ?? document;
	for (let index = 0; index < 30; index += 1) {
		if (!namedControl(form, `factType${index}`)) {
			return undefined;
		}
		if (controlValue(form, `factType${index}`) === type) {
			return String(index);
		}
	}
	return undefined;
};

const fieldsFor = (person: ConnectorPerson, keys: FieldKey[], profile = false): WriteField[] => {
	const fields: WriteField[] = [];
	const form = activeForm() ?? document;
	const birthRow = profile ? undefined : factRow("BIRT");
	const deathRow = profile ? undefined : factRow("DEAT");
	if (keys.includes("name")) {
		if (person.givenName) {
			fields.push({ id: "firstName", value: person.givenName });
		}
		if (person.surname) {
			fields.push({ id: "lastName", value: person.surname });
		}
	}
	if (keys.includes("sex") && person.sex) {
		const id = person.sex === "M" ? "genderM" : person.sex === "F" ? "genderF" : "genderU";
		fields.push({ id, check: true });
	}
	if (keys.includes("birthDate")) {
		fields.push(
			...dateFields(birthRow && !namedControl(form, "gdp_firstDateYear_birthDate") ? `factDate${birthRow}` : "birthDate", person.birthDate)
		);
	}
	if (keys.includes("birthPlace") && person.birthPlace) {
		const id = birthRow && !namedControl(form, "birthPlace") ? `factPlace${birthRow}` : "birthPlace";
		fields.push({ id, value: person.birthPlace });
	}
	if (keys.includes("deathDate")) {
		fields.push(
			...dateFields(deathRow && !namedControl(form, "gdp_firstDateYear_deathDate") ? `factDate${deathRow}` : "deathDate", person.deathDate)
		);
	}
	if (keys.includes("deathPlace") && person.deathPlace) {
		const id = deathRow && !namedControl(form, "deathPlace") ? `factPlace${deathRow}` : "deathPlace";
		fields.push({ id, value: person.deathPlace });
	}
	if (keys.includes("marriageDate")) {
		fields.push(...dateFields("marriageDate0", person.marriageDate));
	}
	if (keys.includes("marriagePlace") && person.marriagePlace) {
		fields.push({ id: "marriagePlace0", value: person.marriagePlace });
	}
	return fields;
};

const openEditor = async (personId: string, siteId?: string): Promise<boolean> => {
	if (activeForm() && formPersonId() === personId) {
		return true;
	}
	if (onEditorPage()) {
		return false;
	}
	let link = document.querySelector(
		"#editProfilePageLink, a.PK_popupLink[href*='edit-profile.php']"
	) as HTMLAnchorElement | null;
	if (!link) {
		const found = document.body.innerHTML.match(
			/edit-profile\.php\?s=([A-Za-z0-9]+)&(?:amp;)?indID=(\d+)/
		);
		if (found) {
			link = document.createElement("a");
			link.href = `${window.location.origin}/FP/edit-profile.php?s=${found[1]}&indID=${personId}&origin=family-tree`;
			link.className = "PK_popupLink";
			link.id = "editProfilePageLink";
			document.body.append(link);
		} else if (siteId) {
			link = document.createElement("a");
			link.href = `${window.location.origin}/FP/edit-profile.php?s=${siteId}&indID=${personId}&origin=ProfilePage`;
			link.className = "PK_popupLink";
			document.body.append(link);
		}
	}
	connectorLog("myheritage", "open editor", {
		personId,
		siteId,
		href: link?.href,
	});
	link?.click();
	const started = Date.now();
	while (Date.now() - started < 6000) {
		if (activeForm() && formPersonId() === personId) {
			return true;
		}
		await new Promise((resolve) => window.setTimeout(resolve, 200));
	}
	const opened = Boolean(activeForm());
	if (!opened) {
		connectorLog("myheritage", "editor did not open", { personId, siteId });
	}
	return opened;
};

const QUEUE_KEY = "treeviz-mh-queue";
const SAVED_KEY = "treeviz-mh-saved";

type MhJob = {
	personId: string;
	siteId: string;
	page: { kind: "editor"; step: string } | { kind: "tree" };
	payload: Record<string, unknown>;
};

const readQueue = (): MhJob[] => {
	try {
		const raw = sessionStorage.getItem(QUEUE_KEY);
		const parsed = raw ? (JSON.parse(raw) as MhJob[]) : [];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
};

const writeQueue = (jobs: MhJob[]): void => {
	if (!jobs.length) {
		sessionStorage.removeItem(QUEUE_KEY);
		return;
	}
	sessionStorage.setItem(QUEUE_KEY, JSON.stringify(jobs));
};

let applying = false;

const jobUrl = (job: MhJob): string | undefined => {
	if (job.page.kind === "editor") {
		if (onEditorPage() && formPersonId() === job.personId) {
			const url = new URL(location.href);
			url.searchParams.set("step", job.page.step);
			url.searchParams.set("indID", job.personId);
			return url.toString();
		}
		if (!job.siteId) {
			return undefined;
		}
		const url = new URL("/FP/edit-profile.php", location.origin);
		url.searchParams.set("s", job.siteId);
		url.searchParams.set("indID", job.personId);
		url.searchParams.set("origin", "ProfilePage");
		url.searchParams.set("step", job.page.step);
		return url.toString();
	}
	const link = document.querySelector("a[href*='/family-trees/']");
	if (link instanceof HTMLAnchorElement) {
		const url = new URL(link.href, location.origin);
		const treeId =
			valueOf("familyTreeID") || url.searchParams.get("familyTreeID") || "";
		if (treeId) {
			url.searchParams.set("familyTreeID", treeId);
		}
		url.searchParams.set("rootIndividualID", job.personId);
		return url.toString();
	}
	if (/\/family-trees\//i.test(location.pathname)) {
		const url = new URL(location.href);
		url.searchParams.set("rootIndividualID", job.personId);
		return url.toString();
	}
	return undefined;
};

const pageMatches = (job: MhJob): boolean => {
	const here = parseMyHeritageLocation(location.href);
	const person = here?.personId?.replace(/[^\d]/g, "") || "";
	if (person !== job.personId) {
		return false;
	}
	if (job.page.kind === "tree") {
		return here?.kind === "tree";
	}
	return /edit-profile\.php/i.test(location.pathname) && editorStep() === job.page.step;
};

const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => window.setTimeout(resolve, ms));

const runJob = async (job: MhJob): Promise<string> => {
	document.documentElement.setAttribute(
		"data-treeviz-connector-write",
		JSON.stringify(job.payload)
	);
	document.documentElement.removeAttribute("data-treeviz-connector-result");
	const response = await ask({ type: "connector:save-myheritage" });
	if (!response.ok) {
		return "failed";
	}
	const started = Date.now();
	while (Date.now() - started < 12000) {
		const result = document.documentElement.getAttribute("data-treeviz-connector-result");
		if (result && result !== "pending") {
			document.documentElement.removeAttribute("data-treeviz-connector-result");
			return result;
		}
		await sleep(200);
	}
	return sessionStorage.getItem(SAVED_KEY) ? "ok" : "failed";
};

const statusFor = (result: string): string => {
	if (result === "ok") {
		return t("wrote");
	}
	if (result === "no-parent") {
		return t("parentSlotsFull");
	}
	if (result === "missing") {
		return t("missingFact");
	}
	if (result === "unchanged" || result === "no-add") {
		return t("factNotWritten");
	}
	if (result === "no-button") {
		return t("relativesNotWritten");
	}
	return t("failed");
};

const PROFILE_LIFE_TITLE: Record<string, string> = {
	birth: "Birth",
	szuletes: "Birth",
	geburt: "Birth",
	naissance: "Birth",
	nacimiento: "Birth",
	nascita: "Birth",
	death: "Death",
	halal: "Death",
	elhalalozas: "Death",
	tod: "Death",
	deces: "Death",
	defuncion: "Death",
	morte: "Death",
	sterben: "Death",
	marriage: "Marriage",
	hazassag: "Marriage",
	heirat: "Marriage",
	mariage: "Marriage",
	matrimonio: "Marriage",
	boda: "Marriage",
};

/** Notes under birth, death, and marriage on the profile, where those facts can be edited inline. */
const readProfileLifeNotes = (): ConnectorFact[] => {
	const facts: ConnectorFact[] = [];
	for (const card of Array.from(document.querySelectorAll(".profile_page_section.facts .fact"))) {
		const name = card.querySelector(".fact_name")?.textContent?.replace(/\s+/g, " ").trim() || "";
		const note =
			card.querySelector(".fact_additional_content")?.textContent?.replace(/\s+/g, " ").trim() || "";
		const title = PROFILE_LIFE_TITLE[foldName(name).replace(/ /g, "")];
		if (!title || !note || note === "Y") {
			continue;
		}
		facts.push({ title, value: note });
	}
	return facts;
};

const readLiveRelatives = (): Record<"parents" | "spouses" | "children", string[]> => {
	const relatives = { parents: [] as string[], spouses: [] as string[], children: [] as string[] };
	for (const card of Array.from(document.querySelectorAll(".family_relative"))) {
		const name =
			card.querySelector(".relative_name")?.textContent?.trim() ||
			card.querySelector(".mh_typo_11")?.textContent?.trim() ||
			"";
		if (!name) {
			continue;
		}
		if (card.classList.contains("parent")) {
			relatives.parents.push(name);
		} else if (card.classList.contains("spouse")) {
			relatives.spouses.push(name);
		} else if (card.classList.contains("child")) {
			relatives.children.push(name);
		}
	}
	return relatives;
};

const fetchEditor = async (step: string): Promise<Document | null> => {
	if (onEditorPage() && editorStep() === step) {
		return document;
	}
	const url = editorCheckUrl(step);
	if (!url) {
		return null;
	}
	try {
		const response = await fetch(url, { credentials: "include" });
		if (!response.ok) {
			return null;
		}
		return new DOMParser().parseFromString(await response.text(), "text/html");
	} catch {
		return null;
	}
};

const siteFrom = (root: ParentNode): SiteFacts => ({
	layoutKnown: true,
	name: `${valueOf("firstName", root)} ${valueOf("lastName", root)}`.trim(),
	sex: checkedSex(root),
	birthDate: composedDate("birthDate", root),
	birthPlace: valueOf("birthPlace", root),
	deathDate: composedDate("deathDate", root),
	deathPlace: valueOf("deathPlace", root),
	marriageDate: composedDate("marriageDate0", root),
	marriagePlace: valueOf("marriagePlace0", root),
});

const qualifierOf = (raw?: string): string => {
	const text = foldName(raw);
	if (/\b(bef|before|elott|vor|avant|antes)\b/.test(text)) {
		return "2";
	}
	if (/\b(aft|after|utan|nach|apres|despues)\b/.test(text)) {
		return "3";
	}
	if (/\b(abt|about|cir|circa|est|cal|korul)\b/.test(text)) {
		return "4";
	}
	return "1";
};

const datePayload = (raw?: string): { year: string; month: string; day: string; qualifier: string } | undefined => {
	const parsed = parseLooseDate(raw);
	if (!parsed) {
		return undefined;
	}
	return {
		year: String(parsed.y),
		month: parsed.m ? String(parsed.m) : "0",
		day: parsed.d ? String(parsed.d) : "0",
		qualifier: qualifierOf(raw),
	};
};

const FACT_CATEGORY: Record<string, string> = {
	BIRT: "3",
	CHR: "3",
	BAPM: "3",
	DEAT: "7",
	BURI: "7",
	OCCU: "18",
};

const factCategory = (factType: string): string => {
	if (FACT_CATEGORY[factType]) {
		return FACT_CATEGORY[factType];
	}
	if (/^military\b/i.test(factType)) {
		return "1";
	}
	return "0";
};

const factTypesFor = (label: string): string[] => {
	const key = factTitleKey(label);
	const codes = Object.entries(FACT_TYPE_TITLE)
		.filter(([, title]) => factTitleKey(title) === key)
		.map(([code]) => code);
	return codes.length ? codes : [label];
};

const textWithoutDate = (value?: string): string => {
	const date = factDatePhrase(value);
	const text = collapse(value);
	if (!date) {
		return text;
	}
	return text
		.replace(date, " ")
		.replace(/\s+/g, " ")
		.replace(/^[, ]+|[, ]+$/g, "")
		.trim();
};

const SINGLE_FIELDS: Record<string, { step: string; id: string }> = {
	nickname: { step: "essentials", id: "nickname" },
	"former name": { step: "essentials", id: "formerName" },
	"married name": { step: "essentials", id: "marriedName" },
	prefix: { step: "essentials", id: "prefix" },
	suffix: { step: "essentials", id: "suffix" },
	"religious name": { step: "essentials", id: "religiousName" },
	godparents: { step: "essentials", id: "godparents" },
	religion: { step: "personal", id: "religion" },
	nationality: { step: "personal", id: "nationalitiesHeader" },
	language: { step: "personal", id: "languages" },
	political: { step: "personal", id: "politicsHeader" },
	height: { step: "personal", id: "height" },
	weight: { step: "personal", id: "weight" },
	"hair color": { step: "personal", id: "hairColor" },
	"eye color": { step: "personal", id: "eyeColor" },
	"physical description": { step: "personal", id: "physical" },
	interests: { step: "favorites", id: "favoriteInterestsHeader" },
	activities: { step: "favorites", id: "favoriteActivitiesHeader" },
	music: { step: "favorites", id: "favoriteMusicHeader" },
	movies: { step: "favorites", id: "favoriteMoviesHeader" },
	"tv shows": { step: "favorites", id: "favoriteTVShowsHeader" },
	books: { step: "favorites", id: "favoriteBooksHeader" },
	sports: { step: "favorites", id: "favoriteSportsHeader" },
	restaurants: { step: "favorites", id: "favoriteRestaurantsHeader" },
	food: { step: "favorites", id: "favoriteFoodHeader" },
	people: { step: "favorites", id: "favoritePeopleHeader" },
	getaways: { step: "favorites", id: "favoriteGetawaysHeader" },
	quotes: { step: "favorites", id: "favoriteQuotesHeader" },
};

const editorJob = (
	personId: string,
	siteId: string,
	step: string,
	payload: Record<string, unknown>
): MhJob => ({
	personId,
	siteId,
	page: { kind: "editor", step },
	payload,
});

const jobsFor = (
	person: ConnectorPerson,
	tree: ConnectorTree,
	diff: FieldDiff,
	siteId: string,
	relatives: Record<"parents" | "spouses" | "children", string[]>
): MhJob[] => {
	const personId = person.sourcePersonId.replace(/[^\d]/g, "");
	if (diff.key === "parents" || diff.key === "spouses" || diff.key === "children") {
		const group = diff.key;
		const ids =
			group === "parents" ? person.parentIds : group === "spouses" ? person.spouseIds : person.childIds;
		const missing = (ids ?? [])
			.map((id) => personIn(tree, id))
			.filter((relative): relative is ConnectorPerson => Boolean(relative?.name))
			.filter(
				(relative) => !relatives[group].some((siteName) => samePersonName(siteName, relative.name))
			);
		return missing.map((relative) => {
			const parts = splitPersonName(relative.name.replace(/,/g, " "));
			const sex = relative.sex;
			const buttonIds =
				group === "children"
					? sex === "F"
						? ["addDaughterButton"]
						: ["addSonButton"]
					: group === "spouses"
						? ["addPartnerButton"]
						: sex === "F"
							? ["addMotherButton", "addParentButton"]
							: ["addFatherButton", "addParentButton"];
			return {
				personId,
				siteId,
				page: { kind: "tree" as const },
				payload: {
					action: "relative",
					personId,
					buttonIds,
					parent: group === "parents",
					given: relative.givenName || parts.given,
					surname: relative.surname || parts.surname,
					suffix: parts.suffix,
					sex: sex || "U",
					birthPlace: relative.birthPlace,
					date: datePayload(relative.birthDate),
				},
			} satisfies MhJob;
		});
	}
	if (diff.key !== "fact") {
		const step = diff.key.startsWith("marriage") ? "family" : "essentials";
		return [editorJob(personId, siteId, step, { action: "fields", fields: fieldsFor(person, [diff.key], true) })];
	}
	const label = diff.label || "";
	const key = factTitleKey(label);
	const treeParts = splitFactValue(diff.treeviz);
	const siteParts = splitFactValue(diff.site);
	const single = SINGLE_FIELDS[key];
	if (single) {
		return [
			editorJob(personId, siteId, single.step, {
				action: "fields",
				fields: [{ id: single.id, value: diff.treeviz || "" }],
			}),
		];
	}
	if (key === "christening" || key === "burial") {
		const prefix = key === "christening" ? "christeningDate" : "burialDate";
		const placeId = key === "christening" ? "christeningPlace" : "burialPlace";
		return [
			editorJob(personId, siteId, "essentials", {
				action: "fields",
				fields: [
					...dateFields(prefix, treeParts.date),
					{ id: placeId, value: treeParts.place || treeParts.description || "" },
				],
			}),
		];
	}
	if (key === "birth" || key === "death" || key === "marriage") {
		const types = factTypesFor(label);
		return [
			editorJob(personId, siteId, "facts", {
				action: "fact",
				types,
				factType: types[0],
				category: factCategory(types[0] || label),
				genealogy: "5",
				add: false,
				matchYear: "",
				matchHeader: diff.site || "",
				header: diff.treeviz || "",
			}),
		];
	}
	if (key === "cause of death") {
		const cause = treeParts.description || diff.treeviz || "";
		return [
			editorJob(personId, siteId, "essentials", {
				action: "fields",
				fields: [{ id: "causeOfDeath", value: cause }],
			}),
			editorJob(personId, siteId, "facts", {
				action: "fact",
				types: ["DEAT"],
				factType: "DEAT",
				category: "7",
				genealogy: "5",
				add: false,
				matchYear: "",
				matchHeader: "",
				cause,
			}),
		];
	}
	let lead: MhJob | undefined;
	const rowTarget =
		key === "occupation"
			? { step: "work", field: "workHeader", addFn: "addWorkFact", datePrefix: "workDate", facts: true }
			: key === "education"
				? {
						step: "education",
						field: "educationHeader",
						addFn: "addEducationFact",
						datePrefix: "educationDate",
						facts: true,
					}
				: key === "citation"
					? {
							step: "citations",
							field: "citationDescription",
							addFn: "addCitation",
							datePrefix: "citationDate",
							facts: false,
						}
					: key === "biography"
						? {
								step: "biography",
								field: "biographyText",
								addFn: "addBiographyNote",
								datePrefix: "",
								facts: false,
							}
						: undefined;
	if (rowTarget) {
		const rowJob = editorJob(personId, siteId, rowTarget.step, {
			action: "contact",
			field: rowTarget.field,
			addFn: rowTarget.addFn,
			datePrefix: rowTarget.datePrefix,
			from: diff.site || "",
			add: !diff.site,
			skip: true,
			consumesQueue: true,
			value: textWithoutDate(diff.treeviz),
			date: datePayload(treeParts.date),
		});
		if (!rowTarget.facts) {
			return [rowJob];
		}
		lead = rowJob;
	}
	if (key === "web address") {
		const target = splitWebLink(diff.treeviz);
		const current = splitWebLink(diff.site);
		if (!target.url) {
			return [];
		}
		return [
			editorJob(personId, siteId, "contact", {
				action: "contact",
				field: "contactWebAddress",
				nameField: "contactWebUsername",
				addFn: "addWebFact",
				from: current.url,
				add: !current.url,
				value: target.url,
				name: target.name || "",
			}),
		];
	}
	if (key === "residence") {
		return [
			editorJob(personId, siteId, "contact", {
				action: "contact",
				field: "addressAddressOne",
				datePrefix: "addressDate",
				addFn: "addAddressFact",
				from: siteParts.place || siteParts.description,
				add: !diff.site,
				value: treeParts.place || treeParts.description || "",
				date: datePayload(treeParts.date),
			}),
		];
	}
	if (key === "email" || key === "phone" || key === "fax") {
		const field = key === "email" ? "contactEmail" : key === "phone" ? "contactPhone" : "contactFax";
		const addFn = key === "email" ? "addEmailFact" : key === "phone" ? "addPhoneFact" : "addFaxFact";
		return [
			editorJob(personId, siteId, "contact", {
				action: "contact",
				field,
				addFn,
				from: diff.site,
				add: !diff.site,
				value: diff.treeviz || "",
			}),
		];
	}
	const types = factTypesFor(label);
	const siteDate = parseLooseDate(siteParts.date);
	const cause = key === "cause of death";
	const factJob = editorJob(personId, siteId, "facts", {
			action: "fact",
			types: cause ? ["DEAT"] : types,
			factType: types[0],
			category: factCategory(types[0] || label),
			genealogy: "5",
			add: cause ? false : !diff.site,
			matchYear: siteDate?.y ? String(siteDate.y) : "",
			matchHeader: siteParts.description || "",
			header: cause ? undefined : treeParts.description,
			place: cause ? undefined : treeParts.place,
			cause: cause ? treeParts.description || diff.treeviz || "" : undefined,
			date: datePayload(treeParts.date),
		});
	return lead ? [lead, factJob] : [factJob];
};

const showTree = async (
	tree: ConnectorTree,
	personId: string,
	siteId: string | undefined,
	cachedAt?: number
): Promise<void> => {
	const person = personIn(tree, personId);
	if (!person) {
		showPanel({ heading: t("title"), detail: t("notInTree"), cachedAt });
		return;
	}
	const compareSteps = [
		"essentials",
		"facts",
		"contact",
		"family",
		"work",
		"education",
		"biography",
		"favorites",
		"personal",
		"citations",
	] as const;
	const loaded = await Promise.all(compareSteps.map((step) => fetchEditor(step)));
	const byStep = Object.fromEntries(compareSteps.map((step, index) => [step, loaded[index]])) as Record<
		(typeof compareSteps)[number],
		Document | null
	>;
	const essentials = byStep.essentials;
	const factsDoc = byStep.facts;
	const contact = byStep.contact;
	const family = byStep.family;
	const formRoot =
		essentials?.querySelector("#editProfileForm") ??
		factsDoc?.querySelector("#editProfileForm") ??
		null;
	const form = formRoot ? siteFrom(formRoot) : undefined;
	const factsRoot = factsDoc?.querySelector("#editProfileForm");
	if (form && factsRoot) {
		for (let index = 0; index < 40; index += 1) {
			if (!namedControl(factsRoot, `factType${index}`)) {
				break;
			}
			const type = controlValue(factsRoot, `factType${index}`);
			if (type === "DEAT") {
				form.deathDate = composedDate(`factDate${index}`, factsRoot) || form.deathDate;
				form.deathPlace = controlValue(factsRoot, `factPlace${index}`) || form.deathPlace;
			}
			if (type === "BIRT") {
				form.birthDate = composedDate(`factDate${index}`, factsRoot) || form.birthDate;
				form.birthPlace = controlValue(factsRoot, `factPlace${index}`) || form.birthPlace;
			}
		}
	}
	const familyRoot = family?.querySelector("#editProfileForm");
	if (form && familyRoot) {
		form.marriageDate = composedDate("marriageDate0", familyRoot) || form.marriageDate;
		form.marriagePlace = valueOf("marriagePlace0", familyRoot) || form.marriagePlace;
	}
	const collected: ConnectorFact[] = [];
	const relatives = { parents: [] as string[], spouses: [] as string[], children: [] as string[] };
	for (const step of compareSteps) {
		const doc = byStep[step];
		const root = doc?.querySelector("#editProfileForm");
		if (!root) {
			continue;
		}
		const section = readEditorSections(root, step);
		collected.push(...section.facts);
		relatives.parents.push(...section.relatives.parents);
		relatives.spouses.push(...section.relatives.spouses);
	}
	collected.push(...readProfileLifeNotes());
	const live = readLiveRelatives();
	if (live.parents.length) {
		relatives.parents = live.parents;
	}
	if (live.spouses.length) {
		relatives.spouses = live.spouses;
	}
	relatives.children = live.children;
	const known = Boolean(form);
	const diffs = form ? diffPerson(form, person, writable) : [];
	diffs.push(...factListDiffs(collected, person.facts ?? []));
	const namesOf = (ids?: string[]): string[] =>
		(ids ?? [])
			.map((id) => personIn(tree, id)?.name || "")
			.filter(Boolean);
	for (const [key, ids] of [
		["parents", person.parentIds],
		["spouses", person.spouseIds],
		["children", person.childIds],
	] as const) {
		if (!relatives[key].length && !(ids ?? []).length) {
			continue;
		}
		if (key === "children" && !document.querySelector(".family_relative")) {
			continue;
		}
		const diff = diffNameList(key, relatives[key], namesOf(ids));
		if (diff) {
			diffs.push(diff);
		}
	}
	void ask({
		type: "connector:save-site",
		snapshot: {
			source: "myheritage",
			sourceTreeId: siteId ?? tree.sourceTreeId ?? "",
			sourcePersonId: person.sourcePersonId,
			readAt: Date.now(),
			layoutKnown: known,
			diffs,
		},
	});
	connectorLog("myheritage", "compare", {
		tree: tree.name,
		siteId,
		personId,
		known,
		diffs: diffs.map((diff) => ({
			key: diff.key,
			label: diff.label,
			site: diff.site,
			treeviz: diff.treeviz,
		})),
	});
	const saved = sessionStorage.getItem(SAVED_KEY);
	if (saved && !readQueue().length) {
		sessionStorage.removeItem(SAVED_KEY);
	}
	showPanel({
		heading: t("title"),
		detail: t("inTree", { tree: tree.name }),
		cachedAt,
		diffs: known ? diffs : undefined,
		layoutKnown: known ? true : undefined,
		status: saved && !readQueue().length ? t("wrote") : undefined,
		onOpenEditor: known
			? undefined
			: () => {
					patchPanel({ busy: true });
					void openEditor(personId, siteId).then((opened) => {
						if (opened) {
							void showTree(tree, personId, siteId, cachedAt);
						} else {
							patchPanel({ busy: false, status: t("layout") });
						}
					});
				},
		onUpdateSite: known
			? (diff) => {
					void writeSelected(person, tree, diff, siteId ?? "", relatives);
				}
			: undefined,
		onUpdateTree: (diff) => {
			patchPanel({ busy: true });
			void ask({
				type: "connector:update-treeviz",
				sourcePersonId: person.sourcePersonId,
				sourceTreeId: tree.sourceTreeId,
				key: diff.key,
				label: diff.label,
				site: diff.site,
				treeviz: diff.treeviz,
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
		onPickTree: undefined,
	});
};

const writeSelected = async (
	person: ConnectorPerson,
	tree: ConnectorTree,
	diff: FieldDiff,
	siteId: string,
	relatives: Record<"parents" | "spouses" | "children", string[]>
): Promise<void> => {
	if (!navigator.onLine) {
		patchPanel({ status: t("offline") });
		return;
	}
	const jobs = jobsFor(person, tree, diff, siteId, relatives).filter((job) => {
		if (job.payload.action !== "fields") {
			return true;
		}
		const fields = job.payload.fields as WriteField[] | undefined;
		return Boolean(fields?.length);
	});
	if (!jobs.length) {
		patchPanel({
			status:
				diff.key === "parents" || diff.key === "spouses" || diff.key === "children"
					? t("siteNamesPresent")
					: t("factNotWritten"),
		});
		return;
	}
	writeQueue(jobs);
	patchPanel({ busy: true });
	connectorLog("myheritage", "queue write", jobs.map((job) => job.payload.action));
	href = "";
	tick();
};

const continueQueue = async (): Promise<boolean> => {
	const jobs = readQueue();
	if (!jobs.length || applying) {
		return false;
	}
	const job = jobs[0];
	if (!job) {
		return false;
	}
	if (!pageMatches(job)) {
		const url = jobUrl(job);
		if (url && url !== location.href) {
			location.assign(url);
			return true;
		}
		writeQueue([]);
		showPanel({ heading: t("title"), detail: t("failed") });
		return true;
	}
	applying = true;
	writeQueue(jobs.slice(1));
	connectorLog("myheritage", "apply", job.payload.action);
	const result = await runJob(job);
	applying = false;
	connectorLog("myheritage", "apply result", result);
	if (result === "skip") {
		if (!readQueue().length) {
			patchPanel({ busy: false, status: t("factNotWritten") });
			return true;
		}
		href = "";
		tick();
		return true;
	}
	if (result !== "ok") {
		writeQueue([]);
		sessionStorage.removeItem(SAVED_KEY);
		patchPanel({ busy: false, status: statusFor(result) });
		return true;
	}
	if (job.payload.consumesQueue) {
		writeQueue([]);
		return false;
	}
	if (!readQueue().length) {
		return false;
	}
	const stayed = location.href;
	await sleep(1500);
	if (location.href === stayed) {
		href = "";
		tick();
	}
	return true;
};

const renderMatch = async (): Promise<void> => {
	if (await continueQueue()) {
		return;
	}
	const location = parseMyHeritageLocation(window.location.href);
	if (!location?.siteId) {
		connectorLog("myheritage", "url is not a tree or profile", window.location.href);
		return;
	}
	const formId = formPersonId();
	const personId = location.personId || formId;
	if (!personId) {
		showPanel({ heading: t("title"), detail: t("whichPerson") });
		return;
	}
	const index = await loadIndex();
	if (!index) {
		connectorLog("myheritage", "no TreeViz index in this browser");
		showPanel({ heading: t("title"), detail: t("signIn") });
		return;
	}
	connectorLog("myheritage", "page", {
		href: window.location.href,
		kind: location.kind,
		siteId: location.siteId,
		personId,
		formPersonId: formId,
		publishedAt: index.publishedAt,
		trees: index.trees.map((tree) => ({
			source: tree.source,
			id: tree.sourceTreeId,
			people: tree.persons.length,
		})),
	});
	const trees = matchTrees(index, "myheritage", location.siteId, personId);
	if (!trees.length) {
		connectorLog("myheritage", "no matching tree");
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
			trees,
			cachedAt: index.publishedAt,
			onPickTree: (tree) => showTree(tree, personId, location.siteId, index.publishedAt),
		});
		return;
	}
	showTree(preferred, personId, location.siteId, index.publishedAt);
};

let href = "";
const tick = (): void => {
	const marker = `${window.location.href}|${formPersonId()}`;
	if (marker === href) {
		return;
	}
	href = marker;
	void renderMatch();
};

void languageReady.then(() => {
	tick();
	window.setInterval(tick, 1000);
	onLanguage(() => {
		href = "";
		tick();
	});
});

const EDITOR_STEPS: Array<{ step: string; anyOf: string[] }> = [
	{ step: "essentials", anyOf: ["firstName", "lastName"] },
	{ step: "family", anyOf: [] },
	{ step: "contact", anyOf: ["contactEmail0", "contactPhone0", "addressAddressOne0"] },
	{ step: "work", anyOf: ["workHeader0"] },
	{ step: "education", anyOf: ["educationHeader0"] },
	{ step: "favorites", anyOf: ["favoriteInterestsHeader"] },
	{ step: "personal", anyOf: ["religion", "height", "hairColor"] },
	{ step: "citations", anyOf: ["citationSource0", "citationDescription0"] },
	{ step: "facts", anyOf: ["factType0"] },
	{ step: "biography", anyOf: [] },
];

const editorCheckUrl = (step: string): string | undefined => {
	if (onEditorPage()) {
		const url = new URL(location.href);
		url.searchParams.set("step", step);
		return url.toString();
	}
	const parsed = parseMyHeritageLocation(location.href);
	if (!parsed?.siteId || !parsed.personId) {
		return undefined;
	}
	const url = new URL("/FP/edit-profile.php", location.origin);
	url.searchParams.set("s", parsed.siteId);
	url.searchParams.set("indID", parsed.personId.replace(/[^\d]/g, ""));
	url.searchParams.set("origin", "ProfilePage");
	url.searchParams.set("step", step);
	return url.toString();
};

const probeFocus = (doc: Document): Element => {
	const form = doc.querySelector("#editProfileForm");
	if (form instanceof HTMLFormElement) {
		return form;
	}
	return doc.querySelector("#profile-page-root") || doc.querySelector("main") || doc.body;
};

const probeMyHeritage = async (): Promise<string> => {
	const lines: ProbeLine[] = [];
	let html = "";
	const remember = (doc: Document, step: string) => {
		if (html) {
			return;
		}
		html = `\n[${step}]\n${htmlSkeleton(probeFocus(doc))}`;
	};
	if (!onEditorPage()) {
		const parsed = parseMyHeritageLocation(location.href);
		const root = document.querySelector("#profile-page-root");
		lines.push({
			ok: Boolean(parsed?.siteId && parsed.personId),
			name: "profile url",
			detail: parsed?.personId ? `indID ${parsed.personId}` : location.pathname,
		});
		lines.push({
			ok: root instanceof HTMLElement && (root.childElementCount > 0 || Boolean(root.shadowRoot)),
			name: "#profile-page-root",
			detail:
				root instanceof HTMLElement
					? `${root.childElementCount} children${root.shadowRoot ? " shadow" : ""}`
					: "absent",
		});
		if (!(root instanceof HTMLElement) || root.childElementCount === 0) {
			remember(document, "profile");
		}
	}
	if (!editorCheckUrl("essentials")) {
		const report = formatProbe(
			`myheritage ${location.pathname}`,
			[...lines, { ok: false, name: "edit-profile.php" }],
			html || htmlSkeleton(probeFocus(document))
		);
		connectorLog("probe", report);
		return report;
	}
	for (const step of EDITOR_STEPS) {
		const url = editorCheckUrl(step.step);
		if (!url) {
			continue;
		}
		let doc = document;
		if (!onEditorPage() || editorStep() !== step.step) {
			try {
				const response = await fetch(url, { credentials: "include" });
				const text = await response.text();
				doc = new DOMParser().parseFromString(text, "text/html");
				lines.push({ ok: response.ok, name: `${step.step} fetch`, detail: String(response.status) });
			} catch (error) {
				lines.push({
					ok: false,
					name: `${step.step} fetch`,
					detail: error instanceof Error ? error.message : "failed",
				});
				continue;
			}
		}
		const form = doc.querySelector("#editProfileForm");
		lines.push({ ok: form instanceof HTMLFormElement, name: `${step.step} #editProfileForm` });
		if (!(form instanceof HTMLFormElement)) {
			remember(doc, step.step);
			continue;
		}
		if (step.step === "family") {
			const labels = form.querySelectorAll(".FL_Label").length;
			lines.push({ ok: true, name: "family .FL_Label", detail: String(labels) });
			continue;
		}
		if (step.step === "biography") {
			const area = form.querySelector("textarea");
			lines.push({ ok: area instanceof HTMLTextAreaElement, name: "biography textarea" });
			if (!(area instanceof HTMLTextAreaElement)) {
				remember(doc, "biography");
			}
			continue;
		}
		const found = step.anyOf.filter((name) => form.querySelector(`[name="${CSS.escape(name)}"]`));
		lines.push({
			ok: found.length > 0,
			name: step.step,
			detail: found.length ? found.join(",") : `expected ${step.anyOf.join("|")}`,
		});
		if (!found.length) {
			remember(doc, step.step);
		}
	}
	const report = formatProbe(`myheritage ${location.pathname}`, lines, html || undefined);
	connectorLog("probe", report);
	return report;
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	const body = message as { type?: string };
	if (body?.type !== "connector:probe") {
		return;
	}
	void probeMyHeritage().then((report) => sendResponse({ ok: true, report }));
	return true;
});
