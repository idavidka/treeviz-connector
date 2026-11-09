const HU = {
	title: "TreeViz Connector",
	signIn: "Jelentkezz be a TreeVizbe, és nyisd meg a fát ebben a böngészőben.",
	cached: "A TreeViz-adat {{time}} óta van a böngészőben.",
	notInTree: "Ez a személy nincs a megnyitott TreeViz-fában.",
	inTree: "Ez a személy benne van a TreeViz-fában: {{tree}}.",
	pickTree: "Több TreeViz-fa is tartalmazza ezt a személyt. Válassz egyet.",
	site: "Az oldalon",
	treeviz: "TreeViz",
	update: "Kijelöltek beírása",
	warning:
		"A módosítás az oldalon marad. A TreeViz nem tudja visszavonni. Csak a bejelölt mezők íródnak.",
	layout:
		"Ezt az oldal-elrendezést a TreeViz Connector nem ismeri, ezért nem ír.",
	noDiff: "A TreeViz és az oldal adatai egyeznek.",
	openSource: "Megnyitás ellenőrzésre",
	compare: "Ellenőrizd ezt a személyt a forrás oldalon.",
	wrote: "Beírva.",
	failed: "Nem sikerült beírni.",
	openEdit: "Szerkesztő megnyitása az összevetéshez",
	whichPerson: "Nyisd meg a személy profilját, vagy a szerkesztőjét.",
	offline: "Az írás hálózatot igényel.",
	name: "Név",
	sex: "Nem",
	birthDate: "Születés dátuma",
	birthPlace: "Születés helye",
	deathDate: "Halál dátuma",
	deathPlace: "Halál helye",
	marriageDate: "Házasság dátuma",
	marriagePlace: "Házasság helye",
	missingFact: "A tény nem található az oldalon.",
	batchDone: "Az Ancestry-frissítés kész.",
	log: "Napló",
	copyLog: "Napló másolása",
	copiedLog: "Napló a vágólapon.",
};

const EN: typeof HU = {
	title: "TreeViz Connector",
	signIn: "Sign in to TreeViz and open the tree in this browser.",
	cached: "TreeViz data has been in this browser since {{time}}.",
	notInTree: "This person is not in the open TreeViz tree.",
	inTree: "This person is in the TreeViz tree: {{tree}}.",
	pickTree: "More than one TreeViz tree contains this person. Pick one.",
	site: "On this site",
	treeviz: "TreeViz",
	update: "Write selected fields",
	warning:
		"The change stays on this site. TreeViz cannot undo it. Only checked fields are written.",
	layout: "TreeViz Connector does not know this page layout, so it will not write.",
	noDiff: "TreeViz and this site match.",
	openSource: "Open for review",
	compare: "Review this person on the source site.",
	wrote: "Written.",
	failed: "Could not write.",
	openEdit: "Open the editor to compare",
	whichPerson: "Open the person profile, or the editor.",
	offline: "Writing needs a network connection.",
	name: "Name",
	sex: "Sex",
	birthDate: "Birth date",
	birthPlace: "Birth place",
	deathDate: "Death date",
	deathPlace: "Death place",
	marriageDate: "Marriage date",
	marriagePlace: "Marriage place",
	missingFact: "The fact is not on this page.",
	batchDone: "The Ancestry update is finished.",
	log: "Log",
	copyLog: "Copy log",
	copiedLog: "Log copied.",
};

export type CopyKey = keyof typeof HU;

export const t = (key: CopyKey, vars?: Record<string, string>): string => {
	const table = navigator.language.toLowerCase().startsWith("hu") ? HU : EN;
	let text = table[key];
	if (vars) {
		for (const [name, value] of Object.entries(vars)) {
			text = text.replaceAll(`{{${name}}}`, value);
		}
	}
	return text;
};
