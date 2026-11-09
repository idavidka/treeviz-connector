import { ancestryDateForInput, sameDate, sameText } from "./compare.js";
import { connectorLog } from "./log.js";
import type { AncestryFactUpdate } from "./protocol.js";

const TITLE_ALIASES: Record<string, string[]> = {
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

const aliasKey = (type: string): string => {
	const text = type.trim().toLocaleLowerCase();
	for (const [key, names] of Object.entries(TITLE_ALIASES)) {
		if (names.includes(text) || text === key) {
			return key;
		}
	}
	return text;
};

const titleMatches = (cardTitle: string, type: string): boolean => {
	const card = cardTitle.trim().toLocaleLowerCase().replace(/\s*\(alternate\)\s*$/i, "");
	const wanted = aliasKey(type);
	if (aliasKey(cardTitle) === wanted) {
		return true;
	}
	return card === type.trim().toLocaleLowerCase();
};

type FactCard = {
	root: HTMLElement;
	title: string;
	date: string;
	place: string;
	subtitle: string;
};

export const readAncestryCards = (doc: Document): FactCard[] => {
	return Array.from(doc.querySelectorAll("#researchListFacts li.researchListItem")).map(
		(node) => {
			const root = node as HTMLElement;
			return {
				root,
				title: root.querySelector(".userCardTitle")?.textContent?.trim() || "",
				date: root.querySelector(".factItemDate")?.textContent?.trim() || "",
				place: root.querySelector(".factItemLocation")?.textContent?.trim() || "",
				subtitle: root.querySelector(".userCardSubTitle")?.textContent?.trim() || "",
			};
		}
	);
};

export const ancestryLayoutKnown = (doc: Document): boolean =>
	Boolean(doc.querySelector("#researchListFacts"));

const findCard = (
	cards: FactCard[],
	type: string,
	date?: string,
	place?: string
): FactCard | undefined =>
	cards.find((card) => {
		if (!titleMatches(card.title, type)) {
			return false;
		}
		const dateOk = !date || sameDate(card.date, date) || sameText(card.date, date);
		const placeOk = !place || sameText(card.place, place);
		return dateOk && placeOk;
	});

const setInput = (input: HTMLInputElement, value: string): void => {
	const prototype = Object.getPrototypeOf(input) as HTMLInputElement;
	const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
	descriptor?.set?.call(input, value);
	input.dispatchEvent(new Event("input", { bubbles: true }));
	input.dispatchEvent(new Event("change", { bubbles: true }));
	input.dispatchEvent(
		new FocusEvent("focusout", { bubbles: true, cancelable: true })
	);
};

const waitFor = async <T>(
	read: () => T | undefined,
	kick: () => void,
	timeoutMs: number
): Promise<T> => {
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

const editCard = async (
	card: FactCard,
	to: { date?: string; place?: string }
): Promise<void> => {
	const life = card.root.querySelector(".card.LifeEvent");
	if (!life) {
		throw new Error("no-card");
	}
	const editButton = await waitFor(
		() => {
			const button = life.querySelector("button.cardAction");
			if (life.classList.contains("cardSelected") && button) {
				return button as HTMLButtonElement;
			}
			return undefined;
		},
		() => (life as HTMLElement).click(),
		5000
	);
	const modal = await waitFor(
		() => {
			const fact = document.querySelector("#FactEditComponent")?.closest(".modalFlex");
			const date = fact?.querySelector("input#date") as HTMLInputElement | null;
			const location = fact?.querySelector("input#location") as HTMLInputElement | null;
			if (fact?.classList.contains("open") && date && location) {
				return { fact, date, location };
			}
			return undefined;
		},
		() => editButton.click(),
		5000
	);
	if (to.date) {
		setInput(modal.date, ancestryDateForInput(to.date));
	}
	if (to.place) {
		setInput(modal.location, to.place);
	}
	const save = await waitFor(
		() => {
			const button = modal.fact.querySelector(
				".factEditFooter .editModalSaveButton:not([disabled])"
			);
			return button instanceof HTMLButtonElement ? button : undefined;
		},
		() => undefined,
		5000
	);
	await waitFor(
		() =>
			modal.fact.querySelector(
				".factEditFooter .editModalSaveButton[disabled]"
			) as HTMLButtonElement | null,
		() => save.click(),
		8000
	);
	const close = modal.fact.querySelector("button.modalClose") as HTMLButtonElement | null;
	close?.click();
};

export const writeAncestryFacts = async (
	facts: AncestryFactUpdate[]
): Promise<string[]> => {
	const errors: string[] = [];
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
		} catch (error) {
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

export const checkAncestryFacts = (facts: AncestryFactUpdate[]): string[] => {
	const cards = readAncestryCards(document);
	return facts
		.filter((fact) => !findCard(cards, fact.type, fact.from.date, fact.from.place))
		.map((fact) => fact.type);
};
