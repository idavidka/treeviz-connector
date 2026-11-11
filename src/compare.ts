import type { ConnectorFact, ConnectorPerson, ConnectorSex, FieldDiff, FieldKey } from "./protocol.js";

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
	márc: 3,
	marc: 3,
	apr: 4,
	april: 4,
	avril: 4,
	abril: 4,
	aprile: 4,
	"április": 4,
	ápr: 4,
	may: 5,
	mai: 5,
	mayo: 5,
	maggio: 5,
	maj: 5,
	"május": 5,
	máj: 5,
	jun: 6,
	june: 6,
	juni: 6,
	juin: 6,
	junio: 6,
	giugno: 6,
	junho: 6,
	"június": 6,
	jún: 6,
	jul: 7,
	july: 7,
	juli: 7,
	juillet: 7,
	julio: 7,
	luglio: 7,
	julho: 7,
	"július": 7,
	júl: 7,
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
	szept: 9,
	oct: 10,
	october: 10,
	oktober: 10,
	octobre: 10,
	octubre: 10,
	ottobre: 10,
	outubro: 10,
	"október": 10,
	okt: 10,
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

const FACT_TITLE_ALIASES: Record<string, string> = {
	aka: "also known as",
	"also known": "also known as",
	"e mail": "email",
	address: "residence",
	employment: "occupation",
	"military service": "military",
	"web link": "web address",
	"web links": "web address",
};

/** Same fact under Ancestry's label and the GEDCOM AKA token. */
export const factTitleKey = (title?: string): string => {
	const key = foldName(title);
	return FACT_TITLE_ALIASES[key] || key;
};

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

const NAME_SUFFIX = new Set(["dr", "jr", "sr", "ii", "iii", "iv", "ifj", "phd", "md", "prof"]);

/** Given name and surname. A trailing Dr or Jr does not make a different person. */
export const samePersonName = (left?: string, right?: string): boolean => {
	const strip = (value?: string) =>
		foldName(value)
			.split(" ")
			.filter((word) => word && !NAME_SUFFIX.has(word))
			.join(" ");
	return sameName(strip(left), strip(right));
};

const dateChunk = (): RegExp =>
	/\b(?:bef|before|abt|about|aft|after|cir|circa|est|cal)\.?\s+\d{1,2}\s+\d{1,2}\s+\d{4}\b|\b(?:bef|before|abt|about|aft|after|cir|circa|est|cal)\.?\s+\d{4}\b|\b\d{1,2}\s+\d{1,2}\s+\d{4}\b|\b\d{1,2}\s+[a-z]{3,}\.?\s+\d{4}\b|\b[a-z]{3,}\.?\s+\d{4}\b|\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b|\b\d{4}\b/gi;

const factDates = (value?: string): string[] => {
	const found = collapse(value).match(dateChunk()) ?? [];
	return [...new Set(found.map((part) => part.trim()))];
};

export const factDatePhrase = (value?: string): string | undefined => factDates(value)[0];

/** First names, surname, and a trailing Dr or Jr. */
export const splitPersonName = (
	name: string
): { given: string; surname: string; suffix: string } => {
	const words = collapse(name).split(" ").filter(Boolean);
	let suffix = "";
	const last = words[words.length - 1]?.replace(/\./g, "").toLocaleLowerCase();
	if (words.length > 1 && last && NAME_SUFFIX.has(last)) {
		suffix = words.pop() ?? "";
	}
	if (words.length <= 1) {
		return { given: words[0] ?? "", surname: "", suffix };
	}
	const surname = words.pop() ?? "";
	return { given: words.join(" "), surname, suffix };
};

/** URL plus the words around it, such as a web link title. */
export const splitWebLink = (value?: string): { url?: string; name?: string } => {
	const url = factUrls(value)[0];
	if (!url) {
		return {};
	}
	const name = collapse(value)
		.replace(/https?:\/\/\S+/gi, " ")
		.replace(/[·•,]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	return { url, name: name || undefined };
};

const PLACE_COUNTRY =
	/^(hungary|magyarorszag|romania|russia|ussr|soviet union|szovjetunio|germany|nemetorszag|austria|ausztria|slovakia|szlovakia|ukraine|ukrajna|poland|lengyelorszag|united states|usa|czechoslovakia|csehszlovakia|yugoslavia|jugoszlavia|serbia|szerbia|croatia|horvatorszag|italy|olaszorszag|france|franciaorszag|england|anglia|united kingdom)$/;

const dedupedParts = (parts: string[]): string[] => {
	for (let size = 1; size <= parts.length / 2; size += 1) {
		if (parts.length % size !== 0) {
			continue;
		}
		const cycle = parts.slice(0, size).map((part) => foldName(part));
		const repeated = parts.every((part, index) => foldName(part) === cycle[index % size]);
		if (repeated) {
			return parts.slice(0, size);
		}
	}
	return parts;
};

/** Date, then a city-county-country place, then the remaining description. */
export const splitFactValue = (
	value?: string
): { date?: string; place?: string; description?: string } => {
	const date = factDatePhrase(value);
	let rest = collapse(value).replace(/[•·]/g, ",");
	if (date) {
		rest = rest.replace(date, " ");
	}
	rest = rest.replace(/\s+/g, " ").replace(/^[, ]+|[, ]+$/g, "").trim();
	if (!rest) {
		return { date };
	}
	const parts = dedupedParts(
		rest
			.split(",")
			.map((part) => part.trim())
			.filter(Boolean)
	);
	const countryAt = parts.findIndex((part) => PLACE_COUNTRY.test(foldName(part)));
	if (countryAt >= 0) {
		const description = parts.slice(countryAt + 1).join(", ");
		return {
			date,
			place: parts.slice(0, countryAt + 1).join(", "),
			description: description || undefined,
		};
	}
	if (parts.length >= 4) {
		return {
			date,
			place: parts.slice(0, 3).join(", "),
			description: parts.slice(3).join(", ") || undefined,
		};
	}
	if (parts.length === 1) {
		return { date, description: parts[0] };
	}
	return { date, place: parts.join(", ") };
};

const withoutDates = (value?: string): string =>
	collapse(value)
		.replace(dateChunk(), " ")
		.replace(/https?:\/\/\S+/gi, " ");

/** Same words in any order, so "date, place, title" matches "title, place, date". */
const sameWords = (left: string, right: string): boolean => {
	const key = (value: string) => foldName(value).split(" ").filter(Boolean).sort().join(" ");
	const a = key(left);
	const b = key(right);
	if (!a || !b) {
		return false;
	}
	return a === b || a.includes(b) || b.includes(a);
};

export const factUrls = (value?: string): string[] => {
	const found = collapse(value).match(/https?:\/\/[^\s]+/gi) ?? [];
	return found.map((href) => {
		const trimmed = href.replace(/[),.;]+$/g, "");
		try {
			const url = new URL(trimmed);
			const decode = (part: string) => {
				try {
					return decodeURIComponent(part);
				} catch {
					return part;
				}
			};
			const query = decode(url.search.replace(/^\?/, ""));
			return `${url.origin}${decode(url.pathname)}${query ? `?${query}` : ""}`.replace(/\/$/, "");
		} catch {
			return trimmed.replace(/\/$/, "");
		}
	});
};

/** Same event when the date matches and either text contains the other. A repeated date counts once. */
export const sameFactValue = (left?: string, right?: string): boolean => {
	if (sameName(left, right)) {
		return true;
	}
	const urlsLeft = factUrls(left);
	const urlsRight = factUrls(right);
	if (urlsLeft.length && urlsRight.length) {
		if (!urlsLeft.some((href) => urlsRight.includes(href))) {
			return false;
		}
		const leftover = (value?: string) =>
			foldName(collapse(value).replace(/https?:\/\/\S+/gi, " "));
		const leftName = leftover(left);
		const rightName = leftover(right);
		if (!leftName || !rightName) {
			return true;
		}
		return (
			leftName === rightName ||
			leftName.includes(rightName) ||
			rightName.includes(leftName)
		);
	}
	const datesLeft = factDates(left);
	const datesRight = factDates(right);
	if (
		datesLeft.length &&
		datesRight.length &&
		!datesLeft.some((date) => datesRight.some((other) => sameDate(date, other)))
	) {
		return false;
	}
	const textLeft = withoutDates(left);
	const textRight = withoutDates(right);
	if (!foldName(textLeft) || !foldName(textRight)) {
		return Boolean(datesLeft.length && datesRight.length);
	}
	return sameWords(textLeft, textRight);
};

/** Same wording once the dates are removed, so one award with two years stays one row. */
export const sameFactText = (left?: string, right?: string): boolean => sameWords(withoutDates(left), withoutDates(right));

export const diffFactValues = (
	siteFacts: ConnectorFact[],
	treeFacts: ConnectorFact[],
	treeWritable: boolean
): FieldDiff[] => {
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
		const unmatchedSite = siteValues.filter(
			(value) => !treeValues.some((treeValue) => sameFactValue(treeValue, value))
		);
		const unmatchedTree = treeValues.filter(
			(value) => !siteValues.some((siteValue) => sameFactValue(siteValue, value))
		);
		const used = new Set<number>();
		for (const site of unmatchedSite) {
			const index = unmatchedTree.findIndex(
				(treeValue, treeIndex) => !used.has(treeIndex) && sameFactText(site, treeValue)
			);
			if (index >= 0) {
				used.add(index);
				diffs.push({
					key: "fact",
					label: title,
					site,
					treeviz: unmatchedTree[index],
					writable: treeWritable,
				});
				continue;
			}
			diffs.push({ key: "fact", label: title, site, writable: false });
		}
		unmatchedTree.forEach((treeValue, index) => {
			if (used.has(index)) {
				return;
			}
			diffs.push({
				key: "fact",
				label: title,
				treeviz: treeValue,
				writable: treeWritable,
			});
		});
	}
	return diffs;
};

export const diffNameList = (
	key: FieldKey,
	siteNames: string[],
	treeNames: string[]
): FieldDiff | undefined => {
	const unmatchedSite = siteNames.filter(
		(siteName) => !treeNames.some((treeName) => samePersonName(siteName, treeName))
	);
	const unmatchedTree = treeNames.filter(
		(treeName) => !siteNames.some((siteName) => samePersonName(siteName, treeName))
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
	const numbers: number[] = [];
	for (const token of tokens) {
		if (MONTHS[token]) {
			month = MONTHS[token];
			continue;
		}
		if (/^\d{1,2}$/.test(token) && token !== yearMatch[0]) {
			const n = Number(token);
			if (n >= 1 && n <= 31) {
				numbers.push(n);
			}
		}
	}
	if (month) {
		day = numbers.find((n) => n >= 1 && n <= 31);
	} else if (numbers.length >= 2) {
		const [first, second] = numbers;
		if (second <= 12) {
			day = first;
			month = second;
		} else if (first <= 12) {
			month = first;
			day = second;
		} else {
			day = first;
		}
	} else if (numbers.length === 1 && numbers[0] <= 12) {
		month = numbers[0];
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
	const qualifier = collapse(value).match(
		/^(bef|before|abt|about|aft|after|cir|circa|est|cal)\b\.?/i
	)?.[0];
	const lead = qualifier ? qualifier.replace(/\.$/, "") : "";
	const withLead = (body: string) => (lead ? `${lead} ${body}` : body);
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
		return withLead(`${parsed.d} ${month[parsed.m]} ${parsed.y}`);
	}
	if (parsed.m) {
		return withLead(`${month[parsed.m]} ${parsed.y}`);
	}
	return withLead(String(parsed.y));
};
