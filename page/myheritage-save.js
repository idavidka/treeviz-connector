/* Runs in the page world. Fills the open MyHeritage editor or the family-tree add-person form, then saves. */
(function () {
	var root = document.documentElement;
	var raw = root.getAttribute("data-treeviz-connector-write");
	root.removeAttribute("data-treeviz-connector-write");
	var set = function (value) {
		root.setAttribute("data-treeviz-connector-result", value);
	};
	if (!raw) {
		set("empty");
		return;
	}
	var job;
	try {
		job = JSON.parse(raw);
	} catch (error) {
		set("bad-json");
		return;
	}
	if (Array.isArray(job)) {
		job = { action: "fields", fields: job };
	}
	if (!job || typeof job !== "object") {
		set("bad-json");
		return;
	}

	var setField = function (field) {
		if (!field || !field.id) {
			return;
		}
		var el = document.getElementById(field.id);
		if (!el) {
			el = document.querySelector('[name="' + field.id + '"]');
		}
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
		if (window.tinymce && typeof tinymce.get === "function") {
			var editor = tinymce.get(el.id);
			if (editor) {
				editor.setContent(el.value);
			}
		}
	};

	var named = function (name) {
		return document.querySelector('[name="' + name + '"]');
	};

	var countNamed = function (prefix) {
		var index = 0;
		while (named(prefix + index)) {
			index += 1;
		}
		return index;
	};

	var waitFor = function (ready, timeout) {
		return new Promise(function (resolve) {
			var started = Date.now();
			var tick = function () {
				var found = ready();
				if (found) {
					resolve(found);
					return;
				}
				if (Date.now() - started > timeout) {
					resolve(null);
					return;
				}
				window.setTimeout(tick, 200);
			};
			tick();
		});
	};

	var writeDate = function (prefix, date) {
		if (!date || !prefix) {
			return;
		}
		setField({ id: "gdp_firstDateYear_" + prefix, value: date.year || "" });
		setField({ id: "gdp_firstDateMonth_" + prefix, value: date.month || "0" });
		setField({ id: "gdp_firstDateDay_" + prefix, value: date.day || "0" });
		if (date.qualifier) {
			setField({ id: "gdp_dateType_" + prefix, value: date.qualifier });
			setField({ id: "gdp_firstOperatorType_" + prefix, value: date.qualifier });
		}
	};

	var saveEditor = function () {
		try {
			sessionStorage.setItem("treeviz-mh-saved", "1");
		} catch (error) {
			/* The next page can still reload the comparison. */
		}
		if (typeof saveAndCloseClicked === "function") {
			saveAndCloseClicked();
			return "ok";
		}
		if (typeof saveProfile === "function") {
			saveProfile();
			return "ok";
		}
		var form = document.forms.editProfileForm;
		var flag = document.getElementById("isSaveAndNext");
		if (form && flag) {
			flag.value = "0";
			form.submit();
			return "ok";
		}
		try {
			sessionStorage.removeItem("treeviz-mh-saved");
		} catch (error) {
			/* Ignore. */
		}
		return "no-save";
	};

	var findFact = function () {
		var types = job.types || [];
		var only = [];
		var total = countNamed("factType");
		for (var index = 0; index < total; index += 1) {
			var type = named("factType" + index).value;
			if (types.indexOf(type) === -1) {
				continue;
			}
			only.push(index);
			var yearEl = named("gdp_firstDateYear_factDate" + index);
			var headerEl = named("factHeader" + index);
			var year = yearEl ? yearEl.value : "";
			var header = headerEl ? headerEl.value : "";
			if (job.matchYear && year === String(job.matchYear)) {
				return index;
			}
			if (job.matchHeader && header && String(job.matchHeader).indexOf(header) !== -1) {
				return index;
			}
		}
		if (only.length === 1 && !job.add) {
			return only[0];
		}
		return null;
	};

	var fillFact = function (index) {
		if (job.header != null) {
			setField({ id: "factHeader" + index, value: job.header });
		}
		if (job.place != null) {
			setField({ id: "factPlace" + index, value: job.place });
		}
		if (job.cause != null) {
			setField({ id: "causeOfDeath" + index, value: job.cause });
			setField({ id: "factHeader" + index, value: job.cause });
		}
		writeDate("factDate" + index, job.date);
	};

	var findContact = function (field) {
		var total = countNamed(field);
		for (var index = 0; index < total; index += 1) {
			var current = named(field + index).value || "";
			var loose = function (value) {
				return String(value || "")
					.replace(/\/+$/, "")
					.replace(/^https?:\/\//, "");
			};
			if (
				job.from &&
				current &&
				(current.indexOf(job.from) !== -1 ||
					job.from.indexOf(current) !== -1 ||
					loose(current).indexOf(loose(job.from)) !== -1)
			) {
				return index;
			}
		}
		if (!job.add) {
			return null;
		}
		for (var empty = 0; empty < total; empty += 1) {
			if (!(named(field + empty).value || "").trim()) {
				return empty;
			}
		}
		return null;
	};

	var run = async function () {
		if (job.action !== "relative") {
			var editor = await waitFor(function () {
				return document.getElementById("editProfileForm");
			}, 8000);
			if (!editor) {
				set("no-form");
				return;
			}
		}
		if (job.action === "relative") {
			var menu = document.getElementById("left_panel_add");
			if (menu) {
				menu.click();
			}
			var button = await waitFor(function () {
				var ids = job.buttonIds || [];
				for (var i = 0; i < ids.length; i += 1) {
					var found = document.getElementById(ids[i]);
					if (found) {
						return found;
					}
				}
				return null;
			}, 8000);
			if (!button) {
				set(job.parent ? "no-parent" : "no-button");
				return;
			}
			button.click();
			var form = await waitFor(function () {
				return document.getElementById("addIndividualForm");
			}, 4000);
			if (!form) {
				set("no-form");
				return;
			}
			var source = form.querySelector("[name='sourceIndividualID']");
			if (job.personId && source && source.value && source.value !== job.personId) {
				var cancel = document.getElementById("cancelBtn");
				if (cancel) {
					cancel.click();
				}
				set("wrong-person");
				return;
			}
			setField({ id: "firstName", value: job.given || "" });
			setField({ id: "lastName", value: job.surname || "" });
			if (job.suffix) {
				setField({ id: "suffix", value: job.suffix });
			}
			var genderId = job.sex === "F" ? "genderF" : job.sex === "M" ? "genderM" : "genderU";
			setField({ id: genderId, check: true });
			writeDate("birthDate", job.date);
			if (job.birthPlace) {
				setField({ id: "birthPlace", value: job.birthPlace });
			}
			var ok = document.getElementById("OKBtn");
			if (!ok) {
				set("no-save");
				return;
			}
			try {
				sessionStorage.setItem("treeviz-mh-saved", "1");
			} catch (error) {
				/* Ignore. */
			}
			ok.click();
			window.setTimeout(function () {
				if (document.getElementById("addIndividualForm")) {
					try {
						sessionStorage.removeItem("treeviz-mh-saved");
					} catch (error) {
						/* Ignore. */
					}
					set("failed");
					return;
				}
				set("ok");
			}, 1200);
			return;
		}

		if (job.action === "fact") {
			var index = findFact();
			if (index == null && job.add) {
				if (typeof onFactTypeSelected !== "function") {
					set("no-add");
					return;
				}
				var before = countNamed("factType");
				onFactTypeSelected(String(job.genealogy || "5"), String(job.category || "0"), job.factType);
				var created = await waitFor(function () {
					return countNamed("factType") > before ? countNamed("factType") - 1 : null;
				}, 8000);
				index = created;
			}
			if (index == null) {
				set("missing");
				return;
			}
			fillFact(index);
			set(saveEditor());
			return;
		}

		if (job.action === "contact") {
			var row = findContact(job.field);
			if (row == null && job.add && typeof window[job.addFn] === "function") {
				var previous = countNamed(job.field);
				window[job.addFn]();
				var added = await waitFor(function () {
					return countNamed(job.field) > previous ? countNamed(job.field) - 1 : null;
				}, 3000);
				row = added;
			}
			if (row == null) {
				set(job.skip ? "skip" : "missing");
				return;
			}
			setField({ id: job.field + row, value: job.value || "" });
			if (job.nameField) {
				setField({ id: job.nameField + row, value: job.name || "" });
			}
			if (job.extra) {
				Object.keys(job.extra).forEach(function (prefix) {
					setField({ id: prefix + row, value: job.extra[prefix] || "" });
				});
			}
			writeDate(job.datePrefix ? job.datePrefix + row : "", job.date);
			set(saveEditor());
			return;
		}

		if (job.action === "fields") {
			(job.fields || []).forEach(setField);
			set(saveEditor());
			return;
		}

		set("bad-json");
	};

	set("pending");
	void run();
})();
