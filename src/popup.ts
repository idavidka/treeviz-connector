import { t } from "./i18n.js";
import { INDEX_KEY, type ConnectorIndex, type ConnectorTree } from "./protocol.js";

const TREEVIZ_URLS = [
	"https://treeviz.com/*",
	"https://www.treeviz.com/*",
	"https://dev.treeviz.com/*",
	"https://qa.treeviz.com/*",
	"http://localhost/*",
];

const status = document.querySelector("#status");
const trees = document.querySelector("#trees");
const openButton = document.querySelector("#open");

if (openButton) {
	openButton.textContent = t("openApp");
}

const sourceLabel = (tree: ConnectorTree): string => {
	if (tree.source === "ancestry") {
		return "Ancestry";
	}
	if (tree.source === "myheritage") {
		return "MyHeritage";
	}
	return tree.source;
};

chrome.storage.local.get(INDEX_KEY, (items) => {
	const index = items[INDEX_KEY] as ConnectorIndex | undefined;
	if (!status || !trees) {
		return;
	}
	if (!index || index.trees.length === 0) {
		status.textContent = t("signIn");
		return;
	}
	const when = new Date(index.publishedAt).toLocaleString();
	status.textContent = t("cached", { time: when });
	for (const tree of index.trees) {
		const item = document.createElement("li");
		item.className = "tree";
		const name = document.createElement("strong");
		name.textContent = tree.name;
		const meta = document.createElement("span");
		meta.textContent = `${sourceLabel(tree)} · ${t("persons", { count: String(tree.persons.length) })}`;
		item.append(name, meta);
		trees.append(item);
	}
});

openButton?.addEventListener("click", () => {
	void chrome.tabs.query({ url: TREEVIZ_URLS }).then((found) => {
		const tab = found.find((item) => item.id != null);
		if (tab?.id != null) {
			void chrome.tabs.update(tab.id, { active: true });
			return;
		}
		void chrome.tabs.create({ url: "https://treeviz.com", active: true });
	});
});
