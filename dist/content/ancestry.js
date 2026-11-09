import { ancestryLayoutKnown, checkAncestryFacts, readAncestryCards, writeAncestryFacts, } from "../ancestry-writer.js";
import { diffPerson } from "../compare.js";
import { t } from "../i18n.js";
import { connectorLog } from "../log.js";
import { loadIndex, matchTrees, personIn, preferActive, ask } from "../match.js";
import { parseAncestryLocation } from "../parse-url.js";
import { showPanel, patchPanel } from "../panel.js";
const cardText = (cards, aliases) => cards.find((card) => aliases.includes(card.title.toLocaleLowerCase()));
const siteFacts = () => {
    const layoutKnown = ancestryLayoutKnown(document);
    const cards = readAncestryCards(document);
    const name = cardText(cards, ["name", "név", "nev", "nom", "nombre"]);
    const sex = cardText(cards, ["gender", "nem", "geschlecht", "sexe", "sexo"]);
    const birth = cardText(cards, ["birth", "születés", "szuletes", "geburt", "naissance", "nacimiento"]);
    const death = cardText(cards, ["death", "halál", "halal", "tod", "décès", "deces", "defunción"]);
    const marriage = cardText(cards, ["marriage", "házasság", "hazassag", "heirat", "mariage", "matrimonio"]);
    return {
        layoutKnown,
        name: name?.subtitle,
        sex: sex?.subtitle,
        birthDate: birth?.date,
        birthPlace: birth?.place,
        deathDate: death?.date,
        deathPlace: death?.place,
        marriageDate: marriage?.date,
        marriagePlace: marriage?.place,
    };
};
const writableOnAncestry = (key) => key === "birthDate" ||
    key === "birthPlace" ||
    key === "deathDate" ||
    key === "deathPlace" ||
    key === "marriageDate" ||
    key === "marriagePlace";
const factType = (key) => {
    if (key.startsWith("birth"))
        return "Birth";
    if (key.startsWith("death"))
        return "Death";
    return "Marriage";
};
const writeSelected = async (person, site, keys) => {
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
    const merged = new Map();
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
const siteValue = (site, key) => site[key];
const treeValue = (person, key) => person[key];
const dateSibling = (site, key) => {
    if (key.startsWith("birth"))
        return site.birthDate;
    if (key.startsWith("death"))
        return site.deathDate;
    return site.marriageDate;
};
const placeSibling = (site, key) => {
    if (key.startsWith("birth"))
        return site.birthPlace;
    if (key.startsWith("death"))
        return site.deathPlace;
    return site.marriagePlace;
};
const dateSiblingTree = (person, key) => {
    if (key.startsWith("birth"))
        return person.birthDate;
    if (key.startsWith("death"))
        return person.deathDate;
    return person.marriageDate;
};
const placeSiblingTree = (person, key) => {
    if (key.startsWith("birth"))
        return person.birthPlace;
    if (key.startsWith("death"))
        return person.deathPlace;
    return person.marriagePlace;
};
const showTree = (tree, personId, cachedAt) => {
    const person = personIn(tree, personId);
    if (!person) {
        showPanel({ heading: t("title"), detail: t("notInTree"), cachedAt });
        return;
    }
    const site = siteFacts();
    const diffs = diffPerson(site, person, writableOnAncestry);
    connectorLog("ancestry", "compare", {
        tree: tree.name,
        treeId: tree.sourceTreeId,
        personId,
        layout: site.layoutKnown,
        facts: Boolean(document.querySelector("#researchListFacts")),
        edit: Boolean(document.querySelector("#FactEditComponent")),
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
        layoutKnown: site.layoutKnown,
        onWrite: (keys) => {
            void writeSelected(person, site, keys);
        },
    });
};
const renderMatch = async () => {
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
const runBatch = async () => {
    if (batchRunning) {
        return;
    }
    batchRunning = true;
    try {
        await runBatchOnce();
    }
    finally {
        batchRunning = false;
    }
};
const runBatchOnce = async () => {
    const location = parseAncestryLocation(window.location.href);
    if (!location) {
        return;
    }
    const response = await ask({
        type: "connector:batch-for-page",
        treeId: location.treeId,
        personId: location.personId,
    });
    const person = response.person;
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
        const all = next.errors ?? errors;
        showPanel({
            heading: t("title"),
            detail: t("batchDone"),
            status: all.length ? all.join("; ") : t("wrote"),
        });
    }
};
let href = "";
const tick = () => {
    if (window.location.href === href) {
        return;
    }
    href = window.location.href;
    void renderMatch().then(() => runBatch());
};
chrome.runtime.onMessage.addListener((message) => {
    const body = message;
    if (body?.type === "connector:run-batch") {
        void runBatch();
    }
});
tick();
window.setInterval(tick, 1000);
