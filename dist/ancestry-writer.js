import { ancestryDateForInput, sameDate, sameText } from "./compare.js";
import { connectorLog } from "./log.js";
const TITLE_ALIASES = {
    birth: ["birth", "születés", "szuletes", "geburt", "naissance", "nacimiento", "nascita"],
    death: ["death", "halál", "halal", "tod", "décès", "deces", "defunción", "defuncion", "morte"],
    marriage: [
        "marriage",
        "házasság",
        "hazassag",
        "heirat",
        "mariage",
        "matrimonio",
        "casamiento",
    ],
};
const aliasKey = (type) => {
    const text = type.trim().toLocaleLowerCase();
    for (const [key, names] of Object.entries(TITLE_ALIASES)) {
        if (names.includes(text) || text === key) {
            return key;
        }
    }
    return text;
};
const titleMatches = (cardTitle, type) => {
    const card = cardTitle.trim().toLocaleLowerCase().replace(/\s*\(alternate\)\s*$/i, "");
    const wanted = aliasKey(type);
    if (aliasKey(cardTitle) === wanted) {
        return true;
    }
    return card === type.trim().toLocaleLowerCase();
};
export const readAncestryCards = (doc) => {
    return Array.from(doc.querySelectorAll("#researchListFacts li.researchListItem")).map((node) => {
        const root = node;
        return {
            root,
            title: root.querySelector(".userCardTitle")?.textContent?.trim() || "",
            date: root.querySelector(".factItemDate")?.textContent?.trim() || "",
            place: root.querySelector(".factItemLocation")?.textContent?.trim() || "",
            subtitle: root.querySelector(".userCardSubTitle")?.textContent?.trim() ||
                Array.from(root.querySelectorAll(".textWrap"))
                    .map((item) => item.textContent?.trim() || "")
                    .filter(Boolean)
                    .join(", "),
        };
    });
};
export const ancestryLayoutKnown = (doc) => Boolean(doc.querySelector("#researchListFacts"));
const findCard = (cards, type, date, place) => cards.find((card) => {
    if (!titleMatches(card.title, type)) {
        return false;
    }
    const dateOk = !date || sameDate(card.date, date) || sameText(card.date, date);
    const placeOk = !place || sameText(card.place, place);
    return dateOk && placeOk;
});
const setInput = (input, value) => {
    const prototype = Object.getPrototypeOf(input);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    descriptor?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true, cancelable: true }));
};
const waitFor = async (read, kick, timeoutMs) => {
    const existing = read();
    if (existing) {
        return existing;
    }
    return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => {
            observer.disconnect();
            reject(new Error("timeout"));
        }, timeoutMs);
        const observer = new MutationObserver(() => {
            const value = read();
            if (value) {
                window.clearTimeout(timer);
                observer.disconnect();
                resolve(value);
            }
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
        });
        kick();
    });
};
const editCard = async (card, to) => {
    const life = card.root.querySelector(".card.LifeEvent");
    if (!life) {
        throw new Error("no-card");
    }
    const editButton = await waitFor(() => {
        const button = life.querySelector("button.cardAction");
        if (life.classList.contains("cardSelected") && button) {
            return button;
        }
        return undefined;
    }, () => life.click(), 5000);
    const modal = await waitFor(() => {
        const fact = document.querySelector("#FactEditComponent")?.closest(".modalFlex");
        const date = fact?.querySelector("input#date");
        const location = fact?.querySelector("input#location");
        if (fact?.classList.contains("open") && date && location) {
            return { fact, date, location };
        }
        return undefined;
    }, () => editButton.click(), 5000);
    if (to.date) {
        setInput(modal.date, ancestryDateForInput(to.date));
    }
    if (to.place) {
        setInput(modal.location, to.place);
    }
    const save = await waitFor(() => {
        const button = modal.fact.querySelector(".factEditFooter .editModalSaveButton:not([disabled])");
        return button instanceof HTMLButtonElement ? button : undefined;
    }, () => undefined, 5000);
    await waitFor(() => modal.fact.querySelector(".factEditFooter .editModalSaveButton[disabled]"), () => save.click(), 8000);
    const close = modal.fact.querySelector("button.modalClose");
    close?.click();
};
export const writeAncestryFacts = async (facts) => {
    const errors = [];
    if (!ancestryLayoutKnown(document)) {
        connectorLog("ancestry", "layout missing #researchListFacts");
        return ["layout"];
    }
    for (const fact of facts) {
        const cards = readAncestryCards(document);
        const card = findCard(cards, fact.type, fact.from.date, fact.from.place);
        if (!card) {
            connectorLog("ancestry", "fact card not found", {
                type: fact.type,
                from: fact.from,
                titles: readAncestryCards(document).map((item) => item.title),
            });
            errors.push(`${fact.type}: missing`);
            continue;
        }
        try {
            await editCard(card, fact.to);
            await new Promise((resolve) => window.setTimeout(resolve, 1500));
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "failed";
            connectorLog("ancestry", "fact edit failed", {
                type: fact.type,
                message,
            });
            errors.push(`${fact.type}: ${message}`);
        }
    }
    return errors;
};
export const checkAncestryFacts = (facts) => {
    const cards = readAncestryCards(document);
    return facts
        .filter((fact) => !findCard(cards, fact.type, fact.from.date, fact.from.place))
        .map((fact) => fact.type);
};
