import { diffNameList, diffPerson, factTitleKey, parseLooseDate, sameName } from "../compare.js";
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

const roleOf = (label: string): "parents" | "spouses" | "children" | undefined => {
	const key = label
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLocaleLowerCase()
		.trim();
	if (/^(father|mother|parent|apa|anya|apja|anyja)$/.test(key)) {
		return "parents";
	}
	if (/^(husband|wife|spouse|ferj|ferje|feleseg|felesege|hazastars|hazastarsa)$/.test(key)) {
		return "spouses";
	}
	if (/^(son|daughter|child|fia|lanya|gyermek|gyermeke)$/.test(key)) {
		return "children";
	}
	return undefined;
};

const readEditorSections = (
	form: ParentNode
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
		pushFact(
			facts,
			"Citation",
			joinParts([
				controlValue(form, `citationSource${index}`),
				controlValue(form, `citationDescription${index}`),
				controlValue(form, `citationPage${index}`),
				composedDate(`citationDate${index}`, form),
			]),
			`citationDescription${index}`
		);
	});
	eachPresent(form, "factType", (index) => {
		const type = controlValue(form, `factType${index}`);
		const title = FACT_TYPE_TITLE[type] || controlValue(form, `factHeader${index}`) || type;
		if (type === "DEAT" && namedControl(form, `causeOfDeath${index}`)) {
			pushFact(
				facts,
				"Cause of Death",
				controlValue(form, `causeOfDeath${index}`),
				`causeOfDeath${index}`
			);
		}
		if (title === "Birth" || title === "Death" || title === "Marriage") {
			return;
		}
		if (namedControl(form, `factHeader${index}`) || namedControl(form, `factPlace${index}`)) {
			pushFact(
				facts,
				title,
				joinParts([
					controlValue(form, `factHeader${index}`),
					controlValue(form, `factPlace${index}`),
					controlValue(form, `causeOfDeath${index}`),
					composedDate(`factDate${index}`, form),
				]),
				namedControl(form, `factHeader${index}`) ? `factHeader${index}` : `factPlace${index}`
			);
		}
	});
	if (editorStep() === "biography") {
		const area = form.querySelector("textarea");
		if (area instanceof HTMLTextAreaElement && area.name) {
			pushFact(facts, "Biography", area.value, area.name);
		}
	}
	if (editorStep() === "family") {
		for (const label of Array.from(form.querySelectorAll(".FL_Label"))) {
			const role = label.nextElementSibling;
			const kind = role ? roleOf(role.textContent || "") : undefined;
			const name = label.textContent?.trim() || "";
			if (kind && name) {
				relatives[kind].push(name);
			}
		}
	}
	return { facts, relatives };
};

const factListDiffs = (siteFacts: ConnectorFact[], treeFacts: ConnectorFact[]): FieldDiff[] => {
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
			diffs.push({ key: "fact", label: title, treeviz: value, writable: true });
		}
	}
	return diffs;
};

const writable = (_key: FieldKey): boolean => true;

const dateFields = (prefix: string, raw?: string): WriteField[] => {
	const parsed = parseLooseDate(raw);
	if (!parsed) {
		return [];
	}
	const fields: WriteField[] = [
		{ id: `gdp_firstDateYear_${prefix}`, value: String(parsed.y) },
	];
	if (parsed.m) {
		fields.push({ id: `gdp_firstDateMonth_${prefix}`, value: String(parsed.m) });
	}
	if (parsed.d) {
		fields.push({ id: `gdp_firstDateDay_${prefix}`, value: String(parsed.d) });
	}
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

const fieldsFor = (person: ConnectorPerson, keys: FieldKey[]): WriteField[] => {
	const fields: WriteField[] = [];
	const form = activeForm() ?? document;
	const birthRow = factRow("BIRT");
	const deathRow = factRow("DEAT");
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

const showTree = (
	tree: ConnectorTree,
	personId: string,
	siteId: string | undefined,
	cachedAt?: number
): void => {
	const person = personIn(tree, personId);
	if (!person) {
		showPanel({ heading: t("title"), detail: t("notInTree"), cachedAt });
		return;
	}
	const form = readForm();
	const formRoot = activeForm();
	const sameForm = Boolean(
		form && (formPersonId() === personId || (onEditorPage() && urlPersonId() === personId))
	);
	const sections = formRoot && sameForm ? readEditorSections(formRoot) : undefined;
	const keep = new Set<FieldKey>();
	if (formRoot && namedControl(formRoot, "firstName")) {
		(["name", "sex", "birthDate", "birthPlace", "deathDate", "deathPlace"] as FieldKey[]).forEach(
			(key) => keep.add(key)
		);
	}
	if (
		formRoot &&
		(namedControl(formRoot, "marriagePlace0") ||
			namedControl(formRoot, "gdp_firstDateYear_marriageDate0"))
	) {
		keep.add("marriageDate");
		keep.add("marriagePlace");
	}
	if (formRoot) {
		for (let index = 0; index < 30; index += 1) {
			if (!namedControl(formRoot, `factType${index}`)) {
				break;
			}
			const type = controlValue(formRoot, `factType${index}`);
			if (type === "DEAT" && form) {
				form.deathDate = composedDate(`factDate${index}`, formRoot) || form.deathDate;
				form.deathPlace = controlValue(formRoot, `factPlace${index}`) || form.deathPlace;
				keep.add("deathDate");
				keep.add("deathPlace");
			}
			if (type === "BIRT" && form) {
				form.birthDate = composedDate(`factDate${index}`, formRoot) || form.birthDate;
				form.birthPlace = controlValue(formRoot, `factPlace${index}`) || form.birthPlace;
				keep.add("birthDate");
				keep.add("birthPlace");
			}
		}
	}
	const diffs = form && sameForm ? diffPerson(form, person, writable).filter((diff) => keep.has(diff.key)) : [];
	if (sections) {
		const relevant = (person.facts ?? []).filter((fact) =>
			fieldByTitle.has(factTitleKey(fact.title))
		);
		diffs.push(...factListDiffs(sections.facts, relevant));
	}
	if (sections && editorStep() === "family") {
		const namesOf = (ids?: string[]): string[] =>
			(ids ?? [])
				.map((id) => personIn(tree, id)?.name || "")
				.filter(Boolean);
		const groups = [
			["parents", person.parentIds],
			["spouses", person.spouseIds],
			["children", person.childIds],
		] as const;
		for (const [key, ids] of groups) {
			const diff = diffNameList(key, sections.relatives[key], namesOf(ids));
			if (diff) {
				diffs.push(diff);
			}
		}
	}
	void ask({
		type: "connector:save-site",
		snapshot: {
			source: "myheritage",
			sourceTreeId: siteId ?? tree.sourceTreeId ?? "",
			sourcePersonId: person.sourcePersonId,
			readAt: Date.now(),
			layoutKnown: sameForm,
			diffs,
		},
	});
	connectorLog("myheritage", "compare", {
		tree: tree.name,
		siteId,
		personId,
		formOpen: Boolean(form),
		formPersonId: formPersonId(),
		sameForm,
		diffs: diffs.map((diff) => ({
			key: diff.key,
			site: diff.site,
			treeviz: diff.treeviz,
		})),
	});
	const site: SiteFacts = form && sameForm ? form : { layoutKnown: false };
	showPanel({
		heading: t("title"),
		detail: t("inTree", { tree: tree.name }),
		cachedAt,
		diffs: sameForm ? diffs : undefined,
		layoutKnown: sameForm ? true : undefined,
		onOpenEditor: sameForm
			? undefined
			: () => {
					patchPanel({ busy: true });
					void openEditor(personId, siteId).then((opened) => {
						if (opened) {
							showTree(tree, personId, siteId, cachedAt);
						} else {
							patchPanel({ busy: false, status: t("layout") });
						}
					});
				},
		onUpdateSite: sameForm
			? (diff) => {
					if (diff.key === "parents" || diff.key === "spouses" || diff.key === "children") {
						patchPanel({ status: t("relativesNotWritten") });
						return;
					}
					void writeSelected(person, diff);
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

const writeSelected = async (person: ConnectorPerson, diff: FieldDiff): Promise<void> => {
	if (!navigator.onLine) {
		patchPanel({ status: t("offline") });
		return;
	}
	let fields = fieldsFor(person, [diff.key]);
	if (diff.key === "fact" && diff.label && diff.treeviz) {
		const id = fieldByTitle.get(factTitleKey(diff.label));
		fields = id ? [{ id, value: diff.treeviz }] : [];
	}
	if (!fields.length) {
		patchPanel({ status: t("factNotWritten") });
		return;
	}
	document.documentElement.setAttribute(
		"data-treeviz-connector-write",
		JSON.stringify(fields)
	);
	patchPanel({ busy: true });
	connectorLog("myheritage", "write fields", fields.map((field) => field.id));
	const response = await ask({ type: "connector:save-myheritage" });
	const result = document.documentElement.getAttribute("data-treeviz-connector-result");
	connectorLog("myheritage", "write result", { ok: response.ok, result });
	document.documentElement.removeAttribute("data-treeviz-connector-result");
	patchPanel({
		busy: false,
		status: response.ok && result === "ok" ? t("wrote") : t("failed"),
	});
};

const renderMatch = async (): Promise<void> => {
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
