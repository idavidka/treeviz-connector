import type { ConnectorPerson, ConnectorSex, FieldDiff, FieldKey } from "./protocol.js";

const MONTHS: Record<string, number> = {
	jan: 1,
	january: 1,
	januar: 1,
	janvier: 1,
	enero: 1,
	gennaio: 1,
	januari: 1,
	"január": 1,
	feb: 2,
	february: 2,
	februar: 2,
	février: 2,
	febrero: 2,
	fevereiro: 2,
	februari: 2,
	"február": 2,
	mar: 3,
	march: 3,
	märz: 3,
	maerz: 3,
	mars: 3,
	marzo: 3,
	março: 3,
	"március": 3,
	apr: 4,
	april: 4,
	avril: 4,
	abril: 4,
	aprile: 4,
	"április": 4,
	may: 5,
	mai: 5,
	mayo: 5,
	maggio: 5,
	maj: 5,
	"május": 5,
	jun: 6,
	june: 6,
	juni: 6,
	juin: 6,
	junio: 6,
	giugno: 6,
	junho: 6,
	"június": 6,
	jul: 7,
	july: 7,
	juli: 7,
	juillet: 7,
	julio: 7,
	luglio: 7,
	julho: 7,
	"július": 7,
	aug: 8,
	august: 8,
	août: 8,
	agosto: 8,
	augustus: 8,
	"augusztus": 8,
	sep: 9,
	sept: 9,
	september: 9,
	septembre: 9,
	septiembre: 9,
	settembre: 9,
	setembro: 9,
	"szeptember": 9,
	oct: 10,
	october: 10,
	oktober: 10,
	octobre: 10,
	octubre: 10,
	ottobre: 10,
	outubro: 10,
	"október": 10,
	nov: 11,
	november: 11,
	novembre: 11,
	noviembre: 11,
	dec: 12,
	december: 12,
	décembre: 12,
	diciembre: 12,
	dicembre: 12,
	dezember: 12,
	dezembro: 12,
};

export type LooseDate = { y: number; m?: number; d?: number };

export const collapse = (value?: string): string =>
	(value ?? "").replace(/\s+/g, " ").trim();

export const foldName = (value?: string): string =>
	collapse(value)
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLocaleLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();

export const sameName = (left?: string, right?: string): boolean => {
	const a = foldName(left);
	const b = foldName(right);
	if (!a || !b) {
		return false;
	}
	if (a === b) {
		return true;
	}
	return a.split(" ").sort().join(" ") === b.split(" ").sort().join(" ");
};

export const diffNameList = (
	key: FieldKey,
	siteNames: string[],
	treeNames: string[]
): FieldDiff | undefined => {
	const unmatchedSite = siteNames.filter(
		(siteName) => !treeNames.some((treeName) => sameName(siteName, treeName))
	);
	const unmatchedTree = treeNames.filter(
		(treeName) => !siteNames.some((siteName) => sameName(siteName, treeName))
	);
	if (!unmatchedSite.length && !unmatchedTree.length) {
		return undefined;
	}
	return {
		key,
		site: siteNames.join(", ") || undefined,
		treeviz: treeNames.join(", ") || undefined,
		writable: false,
	};
};

export const sameText = (left?: string, right?: string): boolean =>
	collapse(left).toLocaleLowerCase() === collapse(right).toLocaleLowerCase();

export const parseLooseDate = (value?: string): LooseDate | undefined => {
	const text = collapse(value);
	if (!text) {
		return undefined;
	}
	const yearMatch = text.match(/\d{4}/);
	if (!yearMatch) {
		return undefined;
	}
	const year = Number(yearMatch[0]);
	const tokens = text
		.toLocaleLowerCase()
		.replace(/[.,]/g, " ")
		.split(/\s+/)
		.filter(Boolean);
	let month: number | undefined;
	let day: number | undefined;
	for (const token of tokens) {
		if (MONTHS[token]) {
			month = MONTHS[token];
			continue;
		}
		if (/^\d{1,2}$/.test(token)) {
			const n = Number(token);
			if (n >= 1 && n <= 31 && day === undefined && token !== yearMatch[0]) {
				day = n;
			}
		}
	}
	// "1990.03.07" or "1990-03-07"
	const numeric = text.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
	if (numeric) {
		return {
			y: Number(numeric[1]),
			m: Number(numeric[2]),
			d: Number(numeric[3]),
		};
	}
	const dmy = text.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/);
	if (dmy) {
		return { y: Number(dmy[3]), m: Number(dmy[2]), d: Number(dmy[1]) };
	}
	return { y: year, m: month, d: day };
};

/** Equal only when the parsed year, month, and day are both present or both absent. */
export const sameDate = (left?: string, right?: string): boolean => {
	const a = parseLooseDate(left);
	const b = parseLooseDate(right);
	if (!a || !b) {
		return sameText(left, right);
	}
	if (a.y !== b.y) {
		return false;
	}
	if (Boolean(a.m) !== Boolean(b.m) || a.m !== b.m) {
		return false;
	}
	if (Boolean(a.d) !== Boolean(b.d) || a.d !== b.d) {
		return false;
	}
	return true;
};

const SEX_WORDS: Record<string, ConnectorSex> = {
	m: "M",
	male: "M",
	férfi: "M",
	ferfi: "M",
	mann: "M",
	männlich: "M",
	homme: "M",
	masculin: "M",
	hombre: "M",
	varón: "M",
	f: "F",
	female: "F",
	nő: "F",
	no: "F",
	frau: "F",
	weiblich: "F",
	femme: "F",
	féminin: "F",
	mujer: "F",
	u: "U",
	unknown: "U",
	ismeretlen: "U",
	unbekannt: "U",
	inconnu: "U",
	desconocido: "U",
};

export const parseSex = (value?: string): ConnectorSex | undefined => {
	const key = collapse(value).toLocaleLowerCase();
	return SEX_WORDS[key];
};

export type SiteFacts = {
	name?: string;
	sex?: string;
	birthDate?: string;
	birthPlace?: string;
	deathDate?: string;
	deathPlace?: string;
	marriageDate?: string;
	marriagePlace?: string;
	layoutKnown: boolean;
};

const equalFor = (key: FieldKey, site?: string, tree?: string): boolean => {
	if (key === "birthDate" || key === "deathDate" || key === "marriageDate") {
		return sameDate(site, tree);
	}
	if (key === "sex") {
		const a = parseSex(site);
		const b = parseSex(tree);
		if (a && b) {
			return a === b;
		}
	}
	return sameText(site, tree);
};

export const diffPerson = (
	site: SiteFacts,
	person: ConnectorPerson,
	writable: (key: FieldKey) => boolean
): FieldDiff[] => {
	const pairs: Array<[FieldKey, string | undefined, string | undefined]> = [
		["name", site.name, person.name],
		["sex", site.sex, person.sex],
		["birthDate", site.birthDate, person.birthDate],
		["birthPlace", site.birthPlace, person.birthPlace],
		["deathDate", site.deathDate, person.deathDate],
		["deathPlace", site.deathPlace, person.deathPlace],
		["marriageDate", site.marriageDate, person.marriageDate],
		["marriagePlace", site.marriagePlace, person.marriagePlace],
	];
	const diffs: FieldDiff[] = [];
	for (const [key, siteValue, treeValue] of pairs) {
		if (!collapse(siteValue) && !collapse(treeValue)) {
			continue;
		}
		if (equalFor(key, siteValue, treeValue)) {
			continue;
		}
		diffs.push({
			key,
			site: collapse(siteValue) || undefined,
			treeviz: collapse(treeValue) || undefined,
			writable: writable(key) && Boolean(collapse(treeValue)),
		});
	}
	return diffs;
};

export const ancestryDateForInput = (value?: string): string => {
	const parsed = parseLooseDate(value);
	if (!parsed) {
		return collapse(value);
	}
	const month = [
		"",
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	];
	if (parsed.d && parsed.m) {
		return `${parsed.d} ${month[parsed.m]} ${parsed.y}`;
	}
	if (parsed.m) {
		return `${month[parsed.m]} ${parsed.y}`;
	}
	return String(parsed.y);
};
