import { t } from "./i18n.js";
import { copyConnectorLog, recentLogLines, subscribeLog } from "./log.js";
import type { ConnectorTree, FieldDiff, FieldKey } from "./protocol.js";

export type PanelModel = {
	heading: string;
	detail?: string;
	cachedAt?: number;
	trees?: ConnectorTree[];
	onPickTree?: (tree: ConnectorTree) => void;
	diffs?: FieldDiff[];
	layoutKnown?: boolean;
	sourceUrl?: string;
	onWrite?: (keys: FieldKey[]) => void;
	busy?: boolean;
	status?: string;
};

const HOST_ID = "treeviz-connector-root";

let current: PanelModel = { heading: "" };

const label = (key: FieldKey): string => t(key);

const render = (host: HTMLElement, model: PanelModel): void => {
	const root = host.shadowRoot;
	if (!root) {
		return;
	}
	root.innerHTML = "";
	const style = document.createElement("style");
	style.textContent = `
		:host { all: initial; }
		.card {
			font: 13px/1.4 system-ui, sans-serif;
			color: #1c1917;
			background: #fff;
			border: 1px solid #d6d3d1;
			border-radius: 12px;
			box-shadow: 0 10px 30px rgba(0,0,0,.18);
			width: 340px;
			max-height: 70vh;
			overflow: auto;
			padding: 12px 14px 14px;
		}
		h2 { font-size: 14px; margin: 0 0 6px; }
		p { margin: 0 0 8px; }
		.muted { color: #57534e; font-size: 12px; }
		.warn { color: #9a3412; font-size: 12px; }
		.row { display: grid; grid-template-columns: 16px 1fr; gap: 8px; margin: 8px 0; }
		.k { font-weight: 600; }
		button, a.btn {
			display: inline-block;
			margin-top: 8px;
			background: #166534;
			color: #fff;
			border: 0;
			border-radius: 8px;
			padding: 8px 10px;
			font: inherit;
			cursor: pointer;
			text-decoration: none;
		}
		button.alt, a.alt { background: #44403c; margin-right: 6px; }
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
	const title = document.createElement("h2");
	title.textContent = model.heading || t("title");
	card.append(title);
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
	const selected = new Set<FieldKey>();
	if (model.diffs) {
		if (model.diffs.length === 0) {
			const p = document.createElement("p");
			p.textContent = t("noDiff");
			card.append(p);
		}
		for (const diff of model.diffs) {
			const row = document.createElement("label");
			row.className = "row";
			const box = document.createElement("input");
			box.type = "checkbox";
			box.disabled = !diff.writable || Boolean(model.busy);
			if (diff.writable) {
				box.checked = true;
				selected.add(diff.key);
				box.addEventListener("change", () => {
					if (box.checked) {
						selected.add(diff.key);
					} else {
						selected.delete(diff.key);
					}
				});
			}
			const text = document.createElement("div");
			const name = document.createElement("div");
			name.className = "k";
			name.textContent = label(diff.key);
			const site = document.createElement("div");
			site.textContent = `${t("site")}: ${diff.site || "—"}`;
			const tree = document.createElement("div");
			tree.textContent = `${t("treeviz")}: ${diff.treeviz || "—"}`;
			text.append(name, site, tree);
			row.append(box, text);
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

export const showPanel = (model: PanelModel): void => {
	current = model;
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

subscribeLog(() => {
	const host = document.getElementById(HOST_ID);
	const pre = host?.shadowRoot?.querySelector("pre[data-connector-log]");
	if (pre) {
		pre.textContent = recentLogLines().join("\n");
	}
});

export const patchPanel = (partial: Partial<PanelModel>): void => {
	showPanel({ ...current, ...partial });
};
