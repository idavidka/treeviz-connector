/** Message names shared with the TreeViz page. The page must not send code. */

export const INDEX_KEY = "treevizConnectorIndex";
export const BATCH_KEY = "treevizConnectorBatch";
export const LOG_KEY = "treevizConnectorLog";
export const SITE_KEY = "treevizConnectorSites";
export const PERSON_CAP = 5000;

export type ConnectorSource = "ancestry" | "myheritage" | "other";

export type ConnectorSex = "M" | "F" | "U";

export type ConnectorPerson = {
	xref: string;
	sourcePersonId: string;
	name: string;
	givenName?: string;
	surname?: string;
	sex?: ConnectorSex;
	birthDate?: string;
	birthPlace?: string;
	deathDate?: string;
	deathPlace?: string;
	marriageDate?: string;
	marriagePlace?: string;
	/** Absolute URL of this person on the source site. */
	sourceUrl?: string;
	/** Source person ids. Present only after TreeViz republishes the tree. */
	parentIds?: string[];
	spouseIds?: string[];
	childIds?: string[];
	/** Other Ancestry facts, besides name, sex, birth, death, and marriage. */
	facts?: ConnectorFact[];
};

export type ConnectorFact = {
	title: string;
	value: string;
};

export type ConnectorTree = {
	uniqueId: string;
	name: string;
	source: ConnectorSource;
	sourceTreeId?: string;
	active: boolean;
	persons: ConnectorPerson[];
};

export type ConnectorIndex = {
	uid: string;
	publishedAt: number;
	truncated: boolean;
	trees: ConnectorTree[];
};

export type AncestryFactUpdate = {
	type: string;
	from: { date?: string; place?: string };
	to: { date?: string; place?: string; description?: string };
};

export type AncestryBatchPerson = {
	treeId: string;
	personId: string;
	facts: AncestryFactUpdate[];
};

export type AncestryBatch = {
	people: AncestryBatchPerson[];
	cursor: number;
	tabId?: number;
	errors: string[];
};

export type FieldKey =
	| "name"
	| "sex"
	| "birthDate"
	| "birthPlace"
	| "deathDate"
	| "deathPlace"
	| "marriageDate"
	| "marriagePlace"
	| "parents"
	| "spouses"
	| "children"
	| "fact";

export type FieldDiff = {
	key: FieldKey;
	/** Fact title, such as Also Known As. */
	label?: string;
	site?: string;
	treeviz?: string;
	writable: boolean;
};

/** Last compare from an Ancestry or MyHeritage page, shown on the TreeViz profile. */
export type SiteSnapshot = {
	source: "ancestry" | "myheritage";
	sourceTreeId: string;
	sourcePersonId: string;
	readAt: number;
	layoutKnown: boolean;
	diffs: FieldDiff[];
};
