import { foldName } from "./compare.js";
const SKIP_TITLES = new Set([
    "name",
    "nev",
    "gender",
    "sex",
    "nem",
    "birth",
    "death",
    "marriage",
    "parents",
    "spouse and children",
    "relationships",
    "timeline",
    "sources",
    "facts",
    "filter",
    "add",
    "filteradd",
    "select fact",
    "selectfact",
    "edit",
    "search",
    "more",
    "life story",
    "gallery",
    "hints",
    "media",
    "story",
    "nothing to see yet",
    "stay tuned",
]);
/** Life-event headers already compared on their own rows, e.g. "BIRTH ABT. 1785". */
const LIFE_HEADER = /^(birth|szuletes|death|halal|marriage|hazassag|baptism|burial|christening|gender|sex|name|nev|nem)\b/;
const chromeLine = (line) => {
    const key = foldName(line);
    const squashed = key.replace(/\s+/g, "");
    return SKIP_TITLES.has(key) || SKIP_TITLES.has(squashed);
};
const factText = (el) => {
    const clone = el.cloneNode(true);
    clone
        .querySelectorAll("button, select, option, label, nav, script, style, [role='button'], [role='tab'], [role='tablist'], [role='combobox'], [role='menu'], [role='toolbar']")
        .forEach((node) => node.remove());
    return clone.innerText?.trim() ?? "";
};
/** Facts from the open Ancestry page, without toolbar and picker labels. */
export const readLooseFacts = (doc, skipWithin) => {
    const facts = [];
    const seen = new Set();
    doc.querySelectorAll("div, li, article, section").forEach((node) => {
        const el = node;
        if (el.closest("#treeviz-connector-root") || (skipWithin && skipWithin.contains(el))) {
            return;
        }
        const text = factText(el);
        if (!text || text.length > 140 || !text.includes("\n")) {
            return;
        }
        if (Array.from(el.children).some((child) => factText(child) === text)) {
            return;
        }
        const lines = text
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line && !chromeLine(line));
        if (lines.length < 2 || lines.length > 4) {
            return;
        }
        const title = lines[0].replace(/\s+edit$/i, "").trim();
        if (!title || title.length > 40 || chromeLine(title) || LIFE_HEADER.test(foldName(title))) {
            return;
        }
        if (/\bof\s+(?:a\s+|an\s+|the\s+)?(?:son|daughter|child|father|mother|husband|wife|spouse|parent)\b/i.test(title)) {
            return;
        }
        if (lines.slice(1).some((line) => LIFE_HEADER.test(foldName(line)) || chromeLine(line))) {
            return;
        }
        const value = lines.slice(1).join(", ").trim();
        if (!value || value.length > 100) {
            return;
        }
        const id = `${foldName(title)}|${foldName(value)}`;
        if (seen.has(id)) {
            return;
        }
        seen.add(id);
        facts.push({ title, value });
    });
    return facts;
};
