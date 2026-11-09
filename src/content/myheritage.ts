import { diffPerson, parseLooseDate } from "../compare.js";
import type { SiteFacts } from "../compare.js";
import { t } from "../i18n.js";
import { connectorLog } from "../log.js";
import { ask, loadIndex, matchTrees, personIn, preferActive } from "../match.js";
import { parseMyHeritageLocation } from "../parse-url.js";
import { showPanel, patchPanel } from "../panel.js";
import type { ConnectorPerson, ConnectorTree, FieldKey } from "../protocol.js";

type WriteField = { id: string; value?: string; check?: boolean };

const valueOf = (id: string): string =>
	(document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null)?.value ||
	"";

const composedDate = (prefix: string): string => {
	const year = valueOf(`gdp_firstDateYear_${prefix}`);
	const month = valueOf(`gdp_firstDateMonth_${prefix}`);
	const day = valueOf(`gdp_firstDateDay_${prefix}`);
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

const checkedSex = (): string => {
	const selected = document.querySelector(
		'#editProfileForm input[name="gender"]:checked'
	) as HTMLInputElement | null;
	return selected?.value || "";
};

const readForm = (): SiteFacts | undefined => {
	const form = document.getElementById("editProfileForm");
	if (!form) {
		return undefined;
	}
	const individual = valueOf("individualID");
	if (!individual) {
		return undefined;
	}
	return {
		layoutKnown: true,
		name: `${valueOf("firstName")} ${valueOf("lastName")}`.trim(),
		sex: checkedSex(),
		birthDate: composedDate("birthDate"),
		birthPlace: valueOf("birthPlace"),
		deathDate: composedDate("deathDate"),
		deathPlace: valueOf("deathPlace"),
		marriageDate: composedDate("marriageDate0"),
		marriagePlace: valueOf("marriagePlace0"),
	};
};

const formPersonId = (): string => valueOf("individualID").replace(/[^\d]/g, "");

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

const fieldsFor = (person: ConnectorPerson, keys: FieldKey[]): WriteField[] => {
	const fields: WriteField[] = [];
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
		fields.push(...dateFields("birthDate", person.birthDate));
	}
	if (keys.includes("birthPlace") && person.birthPlace) {
		fields.push({ id: "birthPlace", value: person.birthPlace });
	}
	if (keys.includes("deathDate")) {
		fields.push(...dateFields("deathDate", person.deathDate));
	}
	if (keys.includes("deathPlace") && person.deathPlace) {
		fields.push({ id: "deathPlace", value: person.deathPlace });
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
	if (document.getElementById("editProfileForm") && formPersonId() === personId) {
		return true;
	}
	let link = document.querySelector(
		'a[href*="edit-profile.php"]'
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
		if (document.getElementById("editProfileForm") && formPersonId() === personId) {
			return true;
		}
		await new Promise((resolve) => window.setTimeout(resolve, 200));
	}
	const opened = Boolean(document.getElementById("editProfileForm"));
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
	const sameForm = Boolean(form && formPersonId() === personId);
	const diffs = form && sameForm ? diffPerson(form, person, writable) : [];
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
		status: sameForm ? undefined : t("openEdit"),
		onUpdateSite: sameForm
			? (key) => {
					void writeSelected(person, [key]);
				}
			: undefined,
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
		onPickTree: undefined,
	});
	if (!sameForm) {
		const host = document.getElementById("treeviz-connector-root");
		const button = document.createElement("button");
		button.type = "button";
		button.textContent = t("openEdit");
		button.addEventListener("click", () => {
			void openEditor(personId, siteId).then((opened) => {
				if (opened) {
					showTree(tree, personId, siteId, cachedAt);
				} else {
					patchPanel({ status: t("layout") });
				}
			});
		});
		host?.shadowRoot?.querySelector(".card")?.append(button);
	}
};

const writeSelected = async (person: ConnectorPerson, keys: FieldKey[]): Promise<void> => {
	if (!navigator.onLine) {
		patchPanel({ status: t("offline") });
		return;
	}
	const fields = fieldsFor(person, keys);
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

tick();
window.setInterval(tick, 1000);
