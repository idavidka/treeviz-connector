import {
	ancestryDateForInput,
	factUrls,
	sameDate,
	samePersonName,
	sameText,
	splitPersonName,
} from "./compare.js";
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
	lines: string[];
};

export const readAncestryCards = (doc: Document): FactCard[] => {
	return Array.from(doc.querySelectorAll("#researchListFacts li.researchListItem")).map(
		(node) => {
			const root = node as HTMLElement;
			const date = root.querySelector(".factItemDate")?.textContent?.trim() || "";
			const place = root.querySelector(".factItemLocation")?.textContent?.trim() || "";
			const subtitle = root.querySelector(".userCardSubTitle")?.textContent?.trim() || "";
			const wraps = Array.from(root.querySelectorAll(".textWrap"))
				.map((item) => item.textContent?.trim() || "")
				.filter(Boolean);
			const lines = [date, place, subtitle, ...wraps].filter(Boolean);
			return {
				root,
				title: root.querySelector(".userCardTitle")?.textContent?.trim() || "",
				date,
				place,
				subtitle: subtitle || wraps.join(", "),
				lines,
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
		const dateOk =
			!date ||
			sameDate(card.date, date) ||
			sameText(card.date, date) ||
			card.lines.some((line) => sameDate(line, date) || sameText(line, date));
		const placeOk = !place || sameText(card.place, place);
		return dateOk && placeOk;
	});

const setInput = (input: HTMLInputElement | HTMLTextAreaElement, value: string): void => {
	const prototype = Object.getPrototypeOf(input) as HTMLInputElement;
	const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
	descriptor?.set?.call(input, value);
	input.dispatchEvent(new Event("input", { bubbles: true }));
	input.dispatchEvent(new Event("change", { bubbles: true }));
	input.dispatchEvent(
		new FocusEvent("focusout", { bubbles: true, cancelable: true })
	);
};

const descriptionControl = (
	fact: Element
): HTMLInputElement | HTMLTextAreaElement | null => {
	const named = fact.querySelector(
		"textarea#description, textarea[name='description'], input#description, input[name='description']"
	);
	if (named instanceof HTMLInputElement || named instanceof HTMLTextAreaElement) {
		return named;
	}
	const area = fact.querySelector("textarea");
	return area instanceof HTMLTextAreaElement ? area : null;
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
	to: { date?: string; place?: string; description?: string }
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
			if (fact?.classList.contains("open") && date) {
				const location = fact.querySelector("input#location") as HTMLInputElement | null;
				return { fact, date, location, description: descriptionControl(fact) };
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
		if (!modal.location) {
			throw new Error("no-place");
		}
		setInput(modal.location, to.place);
	}
	if (to.description) {
		if (!modal.description) {
			throw new Error("no-description");
		}
		setInput(modal.description, to.description);
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

type WebLinkCard = {
	root: HTMLElement;
	name: string;
	url: string;
};

const sameUrl = (left?: string, right?: string): boolean => {
	const a = factUrls(left)[0];
	const b = factUrls(right)[0];
	return Boolean(a && b && a === b);
};

const readWebLinkCards = (doc: Document): WebLinkCard[] =>
	Array.from(doc.querySelectorAll("li.researchListItem")).flatMap((node) => {
		if (!(node instanceof HTMLElement)) {
			return [];
		}
		if (node.closest("#researchListFacts") || node.closest("#familySection")) {
			return [];
		}
		const anchor = node.querySelector("a[href]");
		if (!(anchor instanceof HTMLAnchorElement)) {
			return [];
		}
		let url = "";
		try {
			url = new URL(anchor.href).toString();
		} catch {
			return [];
		}
		if (/ancestry\.|myheritage\./i.test(new URL(url).hostname)) {
			return [];
		}
		return [
			{
				root: node,
				name: node.querySelector(".userCardTitle")?.textContent?.trim() || "",
				url,
			},
		];
	});

const linkName = (url: string, name?: string): string => {
	const trimmed = name?.trim();
	if (trimmed) {
		return trimmed.slice(0, 64);
	}
	try {
		return new URL(url).hostname.slice(0, 64);
	} catch {
		return url.slice(0, 64);
	}
};

export const writeAncestryWebLink = async (link: {
	url: string;
	name?: string;
	fromUrl?: string;
}): Promise<string[]> => {
	const url = link.url.trim().slice(0, 256);
	if (!url) {
		return ["no-url"];
	}
	const current = link.fromUrl
		? readWebLinkCards(document).find((card) => sameUrl(card.url, link.fromUrl))
		: undefined;
	if (link.fromUrl && !current) {
		return ["missing"];
	}
	const openButton = current
		? (current.root.querySelector("button.cardAction") as HTMLButtonElement | null)
		: (document.querySelector("#addWebLinkBtn") as HTMLButtonElement | null);
	if (!openButton) {
		return ["no-link"];
	}
	const modal = await waitFor(
		() => {
			const form = document.querySelector("#webLinkForm")?.closest(".modalFlex");
			const field = form?.querySelector("#webLink");
			if (form?.classList.contains("open") && field instanceof HTMLInputElement) {
				const nameField = form.querySelector("#webLinkName");
				return {
					form,
					field,
					nameField: nameField instanceof HTMLInputElement ? nameField : null,
				};
			}
			return undefined;
		},
		() => openButton.click(),
		5000
	);
	setInput(modal.field, url);
	if (modal.nameField && (link.name || !current)) {
		setInput(modal.nameField, linkName(url, link.name));
	}
	let save: HTMLButtonElement;
	try {
		save = await waitFor(
			() => {
				const button = modal.form.querySelector("#submitWeblink");
				return button instanceof HTMLButtonElement && !button.disabled ? button : undefined;
			},
			() => undefined,
			4000
		);
	} catch {
		modal.form.querySelector<HTMLButtonElement>("button.modalClose, #cancelWeblink")?.click();
		return ["unchanged"];
	}
	await waitFor(
		() => modal.form.querySelector("#submitWeblink[disabled]") as HTMLButtonElement | null,
		() => save.click(),
		8000
	);
	modal.form.querySelector<HTMLButtonElement>("button.modalClose")?.click();
	return [];
};

export type AncestryRelative = {
	name: string;
	sex?: "M" | "F";
};

type AncestryRelation = "Father" | "Mother" | "Spouse" | "Son" | "Daughter";

const relationFor = (
	key: "parents" | "spouses" | "children",
	sex?: "M" | "F"
): AncestryRelation => {
	if (key === "spouses") {
		return "Spouse";
	}
	if (key === "parents") {
		return sex === "F" ? "Mother" : "Father";
	}
	return sex === "F" ? "Daughter" : "Son";
};

const closeRelativeForm = (): void => {
	document
		.querySelector<HTMLButtonElement>("#cancelAddNew, #cancelChooseExisting, #closeAddNew")
		?.click();
};

const openRelativeForm = async (relation: AncestryRelation): Promise<void> => {
	const ready = () => document.querySelector("#addNewForm, #chooseExistingForm") ?? undefined;
	const slot = document.querySelector(`#add${relation}CardBtn`);
	if (slot instanceof HTMLElement) {
		await waitFor(ready, () => slot.click(), 5000);
		return;
	}
	const menu = document.querySelector("#addFamilyBtn");
	if (!(menu instanceof HTMLButtonElement)) {
		throw new Error(relation === "Father" || relation === "Mother" ? "no-parent" : "no-role");
	}
	const item = await waitFor(
		() => document.querySelector(`#add${relation}CalloutBtn`) as HTMLButtonElement | null,
		() => menu.click(),
		4000
	).catch(() => undefined);
	if (!item) {
		throw new Error(relation === "Father" || relation === "Mother" ? "no-parent" : "no-role");
	}
	await waitFor(ready, () => item.click(), 5000);
};

const suggestionFor = (name: string): HTMLElement | undefined =>
	Array.from(document.querySelectorAll(".autocompleteCon.autocompleteVisible li, .autocompleteCon.autocompleteVisible a, .autocompleteCon.autocompleteVisible button")).find(
		(node): node is HTMLElement =>
			node instanceof HTMLElement &&
			node.getBoundingClientRect().height > 0 &&
			samePersonName(node.textContent ?? "", name)
	);

const saveRelative = async (selector: string): Promise<void> => {
	const button = await waitFor(
		() => {
			const found = document.querySelector(selector);
			return found instanceof HTMLButtonElement && !found.disabled ? found : undefined;
		},
		() => undefined,
		4000
	);
	await waitFor(
		() => (document.querySelector("#addNewForm, #chooseExistingForm") ? undefined : document.body),
		() => button.click(),
		8000
	);
};

const linkExistingRelative = async (name: string): Promise<boolean> => {
	const fromTree = document.querySelector("#fromYourTreeRadio");
	if (!(fromTree instanceof HTMLInputElement)) {
		return false;
	}
	fromTree.click();
	const input = await waitFor(
		() => document.querySelector("#apmFindExistingPerson") as HTMLInputElement | null,
		() => undefined,
		3000
	).catch(() => undefined);
	if (!input) {
		return false;
	}
	setInput(input, name);
	const suggestion = await waitFor(() => suggestionFor(name), () => undefined, 2000).catch(
		() => undefined
	);
	if (!suggestion) {
		document.querySelector<HTMLInputElement>("#newPersonRadio")?.click();
		await waitFor(
			() => document.querySelector("#fname") ?? undefined,
			() => undefined,
			3000
		);
		return false;
	}
	suggestion.click();
	await saveRelative("#saveChooseExisting");
	return true;
};

const createRelative = async (person: AncestryRelative): Promise<void> => {
	const { given, surname, suffix } = splitPersonName(person.name);
	const first = await waitFor(
		() => {
			const field = document.querySelector("#fname");
			return field instanceof HTMLInputElement ? field : undefined;
		},
		() => document.querySelector<HTMLInputElement>("#newPersonRadio")?.click(),
		4000
	);
	const last = document.querySelector("#lname");
	const suffixField = document.querySelector("#sufname");
	setInput(first, given || surname);
	if (last instanceof HTMLInputElement) {
		setInput(last, given ? surname : "");
	}
	if (suffix && suffixField instanceof HTMLInputElement) {
		setInput(suffixField, suffix);
	}
	const genderId =
		person.sex === "F" ? "m_genderFemale" : person.sex === "M" ? "m_genderMale" : "m_genderPerson";
	document.querySelector<HTMLInputElement>(`#${genderId}`)?.click();
	await saveRelative("#saveAddNew");
};

const addOneRelative = async (
	key: "parents" | "spouses" | "children",
	person: AncestryRelative
): Promise<void> => {
	await openRelativeForm(relationFor(key, person.sex));
	const linked = await linkExistingRelative(person.name).catch(() => false);
	if (linked) {
		return;
	}
	await createRelative(person);
};

export const writeAncestryRelatives = async (
	key: "parents" | "spouses" | "children",
	people: AncestryRelative[]
): Promise<string[]> => {
	const errors: string[] = [];
	for (const person of people) {
		if (!person.name.trim()) {
			continue;
		}
		try {
			await addOneRelative(key, person);
			await new Promise((resolve) => window.setTimeout(resolve, 800));
		} catch (error) {
			closeRelativeForm();
			const message = error instanceof Error ? error.message : "failed";
			connectorLog("ancestry", "relative add failed", { name: person.name, message });
			errors.push(message === "no-parent" ? "no-parent" : `${person.name}: ${message}`);
		}
	}
	return errors;
};
