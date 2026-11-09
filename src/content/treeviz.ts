import { t } from "../i18n.js";
import { connectorLog } from "../log.js";
import { loadIndex } from "../match.js";
import { profileXrefFromPath } from "../parse-url.js";
import { showPanel } from "../panel.js";

const hide = (): void => {
	document.getElementById("treeviz-connector-root")?.remove();
};

const render = async (): Promise<void> => {
	const xref = profileXrefFromPath(window.location.pathname);
	if (!xref) {
		hide();
		return;
	}
	connectorLog("treeviz", "profile", {
		path: window.location.pathname,
		xref,
	});
	const index = await loadIndex();
	if (!index) {
		connectorLog("treeviz", "no index while a profile is open");
		return;
	}
	const tree = index.trees.find((item) => item.active) || index.trees[0];
	const person = tree?.persons.find((item) => item.xref === xref);
	if (!tree || !person?.sourceUrl) {
		connectorLog("treeviz", "no source url for profile", {
			xref,
			tree: tree?.source,
			sourceTreeId: tree?.sourceTreeId,
			person: Boolean(person),
		});
		hide();
		return;
	}
	connectorLog("treeviz", "offer source page", person.sourceUrl);
	if (tree.source !== "ancestry" && tree.source !== "myheritage") {
		hide();
		return;
	}
	showPanel({
		heading: t("title"),
		detail: `${person.name}. ${t("compare")}`,
		sourceUrl: person.sourceUrl,
		cachedAt: index.publishedAt,
	});
};

let path = "";
const tick = (): void => {
	if (window.location.pathname === path) {
		return;
	}
	path = window.location.pathname;
	void render();
};

tick();
window.setInterval(tick, 750);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	const body = message as { type?: string };
	if (body?.type !== "connector:update-treeviz") {
		return;
	}
	let settled = false;
	const finish = () => {
		if (settled) {
			return;
		}
		settled = true;
		document.removeEventListener("treeviz-connector-update-result", finish);
		const raw = document.documentElement.getAttribute(
			"data-treeviz-connector-update-result"
		);
		document.documentElement.removeAttribute("data-treeviz-connector-update-result");
		let result: unknown = { ok: false, code: "closed" };
		try {
			result = raw ? JSON.parse(raw) : result;
		} catch {
			result = { ok: false, code: "closed" };
		}
		sendResponse(result);
	};
	document.addEventListener("treeviz-connector-update-result", finish);
	document.documentElement.setAttribute(
		"data-treeviz-connector-update",
		JSON.stringify(body)
	);
	document.dispatchEvent(new Event("treeviz-connector-update"));
	window.setTimeout(finish, 5000);
	return true;
});
