/* Runs in the page world. Applies field values already chosen by the user, then calls MyHeritage saveProfile. */
(function () {
	var raw = document.documentElement.getAttribute("data-treeviz-connector-write");
	document.documentElement.removeAttribute("data-treeviz-connector-write");
	if (!raw) {
		document.documentElement.setAttribute(
			"data-treeviz-connector-result",
			"empty"
		);
		return;
	}
	var fields;
	try {
		fields = JSON.parse(raw);
	} catch (error) {
		document.documentElement.setAttribute(
			"data-treeviz-connector-result",
			"bad-json"
		);
		return;
	}
	if (!Array.isArray(fields)) {
		document.documentElement.setAttribute(
			"data-treeviz-connector-result",
			"bad-json"
		);
		return;
	}
	fields.forEach(function (field) {
		if (!field || !field.id) {
			return;
		}
		var el = document.getElementById(field.id);
		if (!el) {
			return;
		}
		if (field.check) {
			el.checked = true;
			el.click();
			el.dispatchEvent(new Event("change", { bubbles: true }));
			return;
		}
		el.value = field.value == null ? "" : String(field.value);
		el.dispatchEvent(new Event("input", { bubbles: true }));
		el.dispatchEvent(new Event("change", { bubbles: true }));
	});
	if (typeof saveProfile !== "function") {
		document.documentElement.setAttribute(
			"data-treeviz-connector-result",
			"no-save"
		);
		return;
	}
	saveProfile();
	document.documentElement.setAttribute("data-treeviz-connector-result", "ok");
})();
