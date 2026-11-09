export type AncestryLocation = {
	site: "ancestry";
	treeId: string;
	personId: string;
};

export type MyHeritageLocation = {
	site: "myheritage";
	siteId?: string;
	personId?: string;
	kind: "profile" | "tree";
};

const ANCESTRY_PERSON =
	/\/family-tree\/person\/tree\/(\d+)\/person\/(\d+)/;
const ANCESTRY_TREE = /\/family-tree\/tree\/(\d+)/;
const MH_PROFILE = /\/profile-([A-Za-z0-9]+)-(\d+)/i;
const MH_TREE = /\/family-trees\/[^/]+\/([A-Za-z0-9]{16,})/i;

export const parseAncestryLocation = (
	href: string
): AncestryLocation | undefined => {
	let url: URL;
	try {
		url = new URL(href);
	} catch {
		return undefined;
	}
	const person = url.pathname.match(ANCESTRY_PERSON);
	if (person) {
		return { site: "ancestry", treeId: person[1], personId: person[2] };
	}
	const tree = url.pathname.match(ANCESTRY_TREE);
	const fpid = url.searchParams.get("fpid") || url.searchParams.get("cfpid");
	if (tree && fpid && /^\d+$/.test(fpid)) {
		return { site: "ancestry", treeId: tree[1], personId: fpid };
	}
	return undefined;
};

export const parseMyHeritageLocation = (
	href: string
): MyHeritageLocation | undefined => {
	let url: URL;
	try {
		url = new URL(href);
	} catch {
		return undefined;
	}
	if (!/myheritage\./i.test(url.hostname)) {
		return undefined;
	}
	const profile = url.pathname.match(MH_PROFILE);
	if (profile) {
		return {
			site: "myheritage",
			siteId: profile[1],
			personId: profile[2],
			kind: "profile",
		};
	}
	const tree = url.pathname.match(MH_TREE);
	if (tree) {
		return { site: "myheritage", siteId: tree[1], kind: "tree" };
	}
	return undefined;
};

export const ancestryFactsUrl = (treeId: string, personId: string): string =>
	`https://www.ancestry.com/family-tree/person/tree/${encodeURIComponent(treeId)}/person/${encodeURIComponent(personId)}/facts`;

export const profileXrefFromPath = (pathname: string): string | undefined => {
	let decoded = pathname;
	try {
		decoded = decodeURIComponent(pathname);
	} catch {
		decoded = pathname;
	}
	const modern = decoded.match(/\/profile\/(@[A-Za-z0-9_-]+@)/);
	if (modern?.[1]) {
		return modern[1];
	}
	const legacy = decoded.match(/\/profile\/([A-Za-z0-9_-]+)\/?$/);
	if (legacy?.[1] && legacy[1] !== "profile") {
		return `@${legacy[1]}@`;
	}
	return undefined;
};
