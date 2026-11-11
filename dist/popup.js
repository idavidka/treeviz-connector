import { LANGUAGE_NAMES, LANGUAGES, currentLanguage, languageReady, onLanguage, setLanguage, t, } from "./i18n.js";
import { INDEX_KEY } from "./protocol.js";
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
const showButton = document.querySelector("#show");
const checkButton = document.querySelector("#check");
const report = document.querySelector("#report");
const note = document.querySelector("#note");
const language = document.querySelector("#language");
if (language instanceof HTMLSelectElement) {
    for (const code of LANGUAGES) {
        const option = document.createElement("option");
        option.value = code;
        option.textContent = LANGUAGE_NAMES[code];
        language.append(option);
    }
    language.addEventListener("change", () => {
        setLanguage(language.value);
    });
}
const sourceLabel = (tree) => {
    if (tree.source === "ancestry") {
        return "Ancestry";
    }
    if (tree.source === "myheritage") {
        return "MyHeritage";
    }
    return tree.source;
};
const render = () => {
    if (language instanceof HTMLSelectElement) {
        language.value = currentLanguage();
        language.setAttribute("aria-label", LANGUAGE_NAMES[currentLanguage()]);
    }
    if (openButton) {
        openButton.textContent = t("openApp");
    }
    if (showButton) {
        showButton.textContent = t("showPanel");
    }
    if (checkButton) {
        checkButton.textContent = t("checkPage");
    }
    chrome.storage.local.get(INDEX_KEY, (items) => {
        const index = items[INDEX_KEY];
        if (!status || !trees) {
            return;
        }
        trees.replaceChildren();
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
};
void languageReady.then(() => {
    render();
    onLanguage(render);
});
checkButton?.addEventListener("click", () => {
    void chrome.tabs.query({ active: true, currentWindow: true }).then(async (found) => {
        const tabId = found[0]?.id;
        if (!(report instanceof HTMLElement)) {
            return;
        }
        report.hidden = false;
        if (tabId == null) {
            report.textContent = t("panelMissing");
            return;
        }
        report.textContent = "…";
        try {
            const response = (await chrome.tabs.sendMessage(tabId, {
                type: "connector:probe",
            }));
            report.textContent = response?.report || t("panelMissing");
        }
        catch {
            report.textContent = t("panelMissing");
        }
    });
});
showButton?.addEventListener("click", () => {
    void chrome.tabs.query({ active: true, currentWindow: true }).then(async (found) => {
        const tabId = found[0]?.id;
        if (tabId == null) {
            if (note)
                note.textContent = t("panelMissing");
            return;
        }
        try {
            const response = (await chrome.tabs.sendMessage(tabId, {
                type: "connector:show-panel",
            }));
            if (note) {
                note.textContent = response?.ok ? t("panelShown") : t("panelMissing");
            }
        }
        catch {
            if (note)
                note.textContent = t("panelMissing");
        }
    });
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
