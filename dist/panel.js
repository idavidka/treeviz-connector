import { t } from "./i18n.js";
import { copyConnectorLog, recentLogLines, subscribeLog } from "./log.js";
const HOST_ID = "treeviz-connector-root";
const HIDDEN_KEY = "treevizConnectorPanelHidden";
let current = { heading: "" };
let hidden = false;
let ready = false;
const persistHidden = (value) => {
    chrome.storage.local.set({ [HIDDEN_KEY]: value });
};
const removeHost = () => {
    document.getElementById(HOST_ID)?.remove();
};
const label = (key) => t(key);
const sourceLabel = () => {
    const host = location.hostname.toLowerCase();
    if (host.includes("ancestry")) {
        return t("onAncestry");
    }
    if (host.includes("myheritage")) {
        return t("onMyHeritage");
    }
    return t("site");
};
const sourceProduct = () => {
    const host = location.hostname.toLowerCase();
    if (host.includes("ancestry")) {
        return "Ancestry";
    }
    if (host.includes("myheritage")) {
        return "MyHeritage";
    }
    return "TreeViz";
};
const render = (host, model) => {
    const root = host.shadowRoot;
    if (!root) {
        return;
    }
    root.innerHTML = "";
    const style = document.createElement("style");
    style.textContent = `
		:host { all: initial; }
		.card {
			font: 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
			color: #101828;
			background: #ffffff;
			border: 1px solid #e3e6ec;
			border-radius: 14px;
			box-shadow: 0 12px 24px rgba(16, 24, 40, 0.10), 0 4px 8px rgba(16, 24, 40, 0.06);
			width: 340px;
			max-height: 70vh;
			overflow: auto;
			padding: 14px;
		}
		.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
		h2 { font-size: 15px; font-weight: 700; margin: 0; letter-spacing: -0.01em; }
		button.hide {
			height: 28px;
			margin: 0;
			flex: none;
			background: #ffffff;
			color: #344054;
			border: 1px solid #e3e6ec;
			box-shadow: none;
		}
		p { margin: 0 0 8px; color: #344054; }
		.muted { color: #667085; font-size: 12px; }
		.warn { color: #b54708; font-size: 12px; }
		.row { display: block; margin: 10px 0; padding-top: 8px; border-top: 1px solid #e3e6ec; }
		.actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
		.actions button { margin: 0; height: 28px; }
		.k { font-weight: 600; }
		button, a.btn {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			height: 32px;
			margin-top: 8px;
			background: #6366f1;
			color: #fff;
			border: 0;
			border-radius: 12px;
			padding: 0 12px;
			font: inherit;
			font-size: 12px;
			font-weight: 600;
			cursor: pointer;
			text-decoration: none;
			box-shadow: 0 8px 24px rgba(99, 102, 241, 0.28);
		}
		button:hover, a.btn:hover { background: #4f46e5; }
		button.alt, a.alt {
			background: #ffffff;
			color: #344054;
			border: 1px solid #e3e6ec;
			box-shadow: none;
			margin-right: 6px;
		}
		button:disabled { opacity: .5; cursor: default; }
		details { margin-top: 10px; }
		summary { cursor: pointer; color: #57534e; font-size: 12px; }
		pre {
			white-space: pre-wrap;
			word-break: break-word;
			background: #f5f5f4;
			border-radius: 8px;
			padding: 8px;
			max-height: 160px;
			overflow: auto;
			font: 11px/1.35 ui-monospace, monospace;
		}
	`;
    const card = document.createElement("div");
    card.className = "card";
    const head = document.createElement("div");
    head.className = "head";
    const title = document.createElement("h2");
    title.textContent = model.heading || t("title");
    const hide = document.createElement("button");
    hide.type = "button";
    hide.className = "hide";
    hide.textContent = t("hide");
    hide.addEventListener("click", () => {
        hidden = true;
        persistHidden(true);
        removeHost();
    });
    head.append(title, hide);
    card.append(head);
    if (model.detail) {
        const p = document.createElement("p");
        p.textContent = model.detail;
        card.append(p);
    }
    if (model.cachedAt) {
        const p = document.createElement("p");
        p.className = "muted";
        p.textContent = t("cached", {
            time: new Date(model.cachedAt).toLocaleString(),
        });
        card.append(p);
    }
    if (model.trees && model.onPickTree) {
        for (const tree of model.trees) {
            const button = document.createElement("button");
            button.className = "alt";
            button.type = "button";
            button.textContent = tree.name;
            button.addEventListener("click", () => model.onPickTree?.(tree));
            card.append(button);
        }
    }
    const selected = new Set();
    if (model.diffs?.some((diff) => diff.writable)) {
        const warn = document.createElement("p");
        warn.className = "warn";
        warn.textContent = t("warning");
        card.append(warn);
    }
    if (model.diffs) {
        if (model.diffs.length === 0 && !model.relativesNote) {
            const p = document.createElement("p");
            p.textContent = t("noDiff");
            card.append(p);
        }
        if (model.relativesNote) {
            const p = document.createElement("p");
            p.textContent = model.relativesNote;
            card.append(p);
        }
        for (const diff of model.diffs) {
            const row = document.createElement("div");
            row.className = "row";
            if (diff.writable) {
                selected.add(diff.key);
            }
            const name = document.createElement("div");
            name.className = "k";
            name.textContent = label(diff.key);
            const site = document.createElement("div");
            site.textContent = `${sourceLabel()}: ${diff.site || "—"}`;
            const tree = document.createElement("div");
            tree.textContent = `${t("treeviz")}: ${diff.treeviz || "—"}`;
            const actions = document.createElement("div");
            actions.className = "actions";
            if (model.onUpdateSite && diff.treeviz) {
                const button = document.createElement("button");
                button.type = "button";
                button.textContent = t("updateSource", { source: sourceProduct() });
                button.disabled = Boolean(model.busy);
                button.addEventListener("click", () => model.onUpdateSite?.(diff.key));
                actions.append(button);
            }
            if (model.onUpdateTree && diff.site) {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "alt";
                button.textContent = t("updateTree");
                button.disabled = Boolean(model.busy);
                button.addEventListener("click", () => model.onUpdateTree?.(diff.key));
                actions.append(button);
            }
            row.append(name, site, tree, actions);
            card.append(row);
        }
    }
    if (model.layoutKnown === false) {
        const p = document.createElement("p");
        p.className = "warn";
        p.textContent = t("layout");
        card.append(p);
    }
    if (model.sourceUrl) {
        const link = document.createElement("a");
        link.className = "btn";
        link.href = model.sourceUrl;
        link.target = "_blank";
        link.rel = "noreferrer";
        link.textContent = t("openSource");
        card.append(link);
    }
    if (model.onWrite && model.diffs?.some((diff) => diff.writable)) {
        const warn = document.createElement("p");
        warn.className = "warn";
        warn.textContent = t("warning");
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = t("update");
        button.disabled = Boolean(model.busy);
        button.addEventListener("click", () => {
            model.onWrite?.([...selected]);
        });
        card.append(warn, button);
    }
    if (model.status) {
        const p = document.createElement("p");
        p.textContent = model.status;
        card.append(p);
    }
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = t("log");
    const pre = document.createElement("pre");
    pre.dataset.connectorLog = "1";
    pre.textContent = recentLogLines().join("\n");
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "alt";
    copy.textContent = t("copyLog");
    copy.addEventListener("click", () => {
        void copyConnectorLog().then((text) => {
            copy.textContent = text ? t("copiedLog") : t("copyLog");
            window.setTimeout(() => {
                copy.textContent = t("copyLog");
            }, 2000);
        });
    });
    details.append(summary, pre, copy);
    card.append(details);
    root.append(style, card);
};
export const showPanel = (model) => {
    current = model;
    if (!ready || hidden) {
        if (hidden) {
            removeHost();
        }
        return;
    }
    let host = document.getElementById(HOST_ID);
    if (!host) {
        host = document.createElement("div");
        host.id = HOST_ID;
        host.style.position = "fixed";
        host.style.right = "16px";
        host.style.bottom = "16px";
        host.style.zIndex = "2147483646";
        host.attachShadow({ mode: "open" });
        document.documentElement.append(host);
    }
    render(host, model);
};
chrome.storage.local.get(HIDDEN_KEY, (items) => {
    hidden = Boolean(items?.[HIDDEN_KEY]);
    ready = true;
    if (current.heading || current.detail) {
        showPanel(current);
    }
});
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const body = message;
    if (body?.type !== "connector:show-panel") {
        return;
    }
    hidden = false;
    persistHidden(false);
    const visible = Boolean(current.heading || current.detail);
    if (visible) {
        showPanel(current);
    }
    sendResponse({ ok: visible });
});
subscribeLog(() => {
    const host = document.getElementById(HOST_ID);
    const pre = host?.shadowRoot?.querySelector("pre[data-connector-log]");
    if (pre) {
        pre.textContent = recentLogLines().join("\n");
    }
});
export const patchPanel = (partial) => {
    showPanel({ ...current, ...partial });
};
