"use strict";
(() => {
  // extensions/treeviz-connector/src/compare.ts
  var MONTHS = {
    jan: 1,
    january: 1,
    januar: 1,
    janvier: 1,
    enero: 1,
    gennaio: 1,
    januari: 1,
    "janu\xE1r": 1,
    feb: 2,
    february: 2,
    februar: 2,
    f\u00E9vrier: 2,
    febrero: 2,
    fevereiro: 2,
    februari: 2,
    "febru\xE1r": 2,
    mar: 3,
    march: 3,
    m\u00E4rz: 3,
    maerz: 3,
    mars: 3,
    marzo: 3,
    mar\u00E7o: 3,
    "m\xE1rcius": 3,
    m\u00E1rc: 3,
    marc: 3,
    apr: 4,
    april: 4,
    avril: 4,
    abril: 4,
    aprile: 4,
    "\xE1prilis": 4,
    \u00E1pr: 4,
    may: 5,
    mai: 5,
    mayo: 5,
    maggio: 5,
    maj: 5,
    "m\xE1jus": 5,
    m\u00E1j: 5,
    jun: 6,
    june: 6,
    juni: 6,
    juin: 6,
    junio: 6,
    giugno: 6,
    junho: 6,
    "j\xFAnius": 6,
    j\u00FAn: 6,
    jul: 7,
    july: 7,
    juli: 7,
    juillet: 7,
    julio: 7,
    luglio: 7,
    julho: 7,
    "j\xFAlius": 7,
    j\u00FAl: 7,
    aug: 8,
    august: 8,
    ao\u00FBt: 8,
    agosto: 8,
    augustus: 8,
    "augusztus": 8,
    sep: 9,
    sept: 9,
    september: 9,
    septembre: 9,
    septiembre: 9,
    settembre: 9,
    setembro: 9,
    "szeptember": 9,
    szept: 9,
    oct: 10,
    october: 10,
    oktober: 10,
    octobre: 10,
    octubre: 10,
    ottobre: 10,
    outubro: 10,
    "okt\xF3ber": 10,
    okt: 10,
    nov: 11,
    november: 11,
    novembre: 11,
    noviembre: 11,
    dec: 12,
    december: 12,
    d\u00E9cembre: 12,
    diciembre: 12,
    dicembre: 12,
    dezember: 12,
    dezembro: 12
  };
  var collapse = (value) => (value ?? "").replace(/\s+/g, " ").trim();
  var sameText = (left, right) => collapse(left).toLocaleLowerCase() === collapse(right).toLocaleLowerCase();
  var parseLooseDate = (value) => {
    const text = collapse(value);
    if (!text) {
      return void 0;
    }
    const yearMatch = text.match(/\d{4}/);
    if (!yearMatch) {
      return void 0;
    }
    const year = Number(yearMatch[0]);
    const tokens = text.toLocaleLowerCase().replace(/[.,]/g, " ").split(/\s+/).filter(Boolean);
    let month;
    let day;
    for (const token of tokens) {
      if (MONTHS[token]) {
        month = MONTHS[token];
        continue;
      }
      if (/^\d{1,2}$/.test(token)) {
        const n = Number(token);
        if (n >= 1 && n <= 31 && day === void 0 && token !== yearMatch[0]) {
          day = n;
        }
      }
    }
    const numeric = text.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
    if (numeric) {
      return {
        y: Number(numeric[1]),
        m: Number(numeric[2]),
        d: Number(numeric[3])
      };
    }
    const dmy = text.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/);
    if (dmy) {
      return { y: Number(dmy[3]), m: Number(dmy[2]), d: Number(dmy[1]) };
    }
    return { y: year, m: month, d: day };
  };
  var sameDate = (left, right) => {
    const a = parseLooseDate(left);
    const b = parseLooseDate(right);
    if (!a || !b) {
      return sameText(left, right);
    }
    if (a.y !== b.y) {
      return false;
    }
    if (Boolean(a.m) !== Boolean(b.m) || a.m !== b.m) {
      return false;
    }
    if (Boolean(a.d) !== Boolean(b.d) || a.d !== b.d) {
      return false;
    }
    return true;
  };
  var SEX_WORDS = {
    m: "M",
    male: "M",
    f\u00E9rfi: "M",
    ferfi: "M",
    mann: "M",
    m\u00E4nnlich: "M",
    homme: "M",
    masculin: "M",
    hombre: "M",
    var\u00F3n: "M",
    f: "F",
    female: "F",
    n\u0151: "F",
    no: "F",
    frau: "F",
    weiblich: "F",
    femme: "F",
    f\u00E9minin: "F",
    mujer: "F",
    u: "U",
    unknown: "U",
    ismeretlen: "U",
    unbekannt: "U",
    inconnu: "U",
    desconocido: "U"
  };
  var parseSex = (value) => {
    const key = collapse(value).toLocaleLowerCase();
    return SEX_WORDS[key];
  };
  var equalFor = (key, site, tree) => {
    if (key === "birthDate" || key === "deathDate" || key === "marriageDate") {
      return sameDate(site, tree);
    }
    if (key === "sex") {
      const a = parseSex(site);
      const b = parseSex(tree);
      if (a && b) {
        return a === b;
      }
    }
    return sameText(site, tree);
  };
  var diffPerson = (site, person, writable2) => {
    const pairs = [
      ["name", site.name, person.name],
      ["sex", site.sex, person.sex],
      ["birthDate", site.birthDate, person.birthDate],
      ["birthPlace", site.birthPlace, person.birthPlace],
      ["deathDate", site.deathDate, person.deathDate],
      ["deathPlace", site.deathPlace, person.deathPlace],
      ["marriageDate", site.marriageDate, person.marriageDate],
      ["marriagePlace", site.marriagePlace, person.marriagePlace]
    ];
    const diffs = [];
    for (const [key, siteValue, treeValue] of pairs) {
      if (!collapse(siteValue) && !collapse(treeValue)) {
        continue;
      }
      if (equalFor(key, siteValue, treeValue)) {
        continue;
      }
      diffs.push({
        key,
        site: collapse(siteValue) || void 0,
        treeviz: collapse(treeValue) || void 0,
        writable: writable2(key) && Boolean(collapse(treeValue))
      });
    }
    return diffs;
  };

  // extensions/treeviz-connector/src/i18n.ts
  var HU = {
    title: "TreeViz Connector",
    signIn: "Jelentkezz be a TreeVizbe, \xE9s nyisd meg a f\xE1t ebben a b\xF6ng\xE9sz\u0151ben.",
    cached: "A TreeViz-adat {{time}} \xF3ta van a b\xF6ng\xE9sz\u0151ben.",
    notInTree: "Ez a szem\xE9ly nincs a megnyitott TreeViz-f\xE1ban.",
    inTree: "Ez a szem\xE9ly benne van a TreeViz-f\xE1ban: {{tree}}.",
    pickTree: "T\xF6bb TreeViz-fa is tartalmazza ezt a szem\xE9lyt. V\xE1lassz egyet.",
    site: "Az oldalon",
    onAncestry: "Ancestryn",
    onMyHeritage: "MyHeritagen",
    treeviz: "TreeViz",
    update: "Kijel\xF6ltek be\xEDr\xE1sa",
    updateSource: "{{source}} friss\xEDt\xE9se",
    updateTree: "Friss\xEDt\xE9s TreeVizben",
    updatedTree: "Be\xEDrva a TreeVizbe.",
    addedRelatives: "Felv\xE9ve a TreeVizbe: {{names}}",
    nothingToAdd: "A TreeVizben m\xE1r megvan minden n\xE9v err\u0151l az oldalr\xF3l.",
    treeClosed: "Nyisd meg ezt a f\xE1t a TreeVizben, azt\xE1n pr\xF3b\xE1ld \xFAjra.",
    ambiguous: "T\xF6bb ilyen nev\u0171 szem\xE9ly van a f\xE1ban: {{names}}",
    relativesNotWritten: "Rokont ezen az elrendez\xE9sen m\xE9g nem \xEDr a forr\xE1s oldalra.",
    warning: "A m\xF3dos\xEDt\xE1s az oldalon marad. A TreeViz nem tudja visszavonni. Csak a bejel\xF6lt mez\u0151k \xEDr\xF3dnak.",
    layout: "Ezt az oldal-elrendez\xE9st a TreeViz Connector nem ismeri, ez\xE9rt nem \xEDr.",
    noDiff: "A TreeViz \xE9s az oldal adatai egyeznek.",
    openSource: "Megnyit\xE1s ellen\u0151rz\xE9sre",
    compare: "Ellen\u0151rizd ezt a szem\xE9lyt a forr\xE1s oldalon.",
    wrote: "Be\xEDrva.",
    failed: "Nem siker\xFClt be\xEDrni.",
    openEdit: "Szerkeszt\u0151 megnyit\xE1sa az \xF6sszevet\xE9shez",
    whichPerson: "Nyisd meg a szem\xE9ly profilj\xE1t, vagy a szerkeszt\u0151j\xE9t.",
    offline: "Az \xEDr\xE1s h\xE1l\xF3zatot ig\xE9nyel.",
    name: "N\xE9v",
    sex: "Nem",
    female: "n\u0151",
    male: "f\xE9rfi",
    birthDate: "Sz\xFClet\xE9s d\xE1tuma",
    birthPlace: "Sz\xFClet\xE9s helye",
    deathDate: "Hal\xE1l d\xE1tuma",
    deathPlace: "Hal\xE1l helye",
    marriageDate: "H\xE1zass\xE1g d\xE1tuma",
    marriagePlace: "H\xE1zass\xE1g helye",
    parents: "Sz\xFCl\u0151k",
    spouses: "H\xE1zast\xE1rsak",
    children: "Gyerekek",
    fact: "T\xE9ny",
    factsStale: "A TreeViz-adatban m\xE9g nincsenek a tov\xE1bbi t\xE9nyek. Friss\xEDtsd a TreeViz lapot, hogy \xFAjra elk\xFCldje a f\xE1t.",
    factNotWritten: "Ezt a t\xE9nyt ezen az elrendez\xE9sen m\xE9g nem \xEDrja a forr\xE1s oldalra.",
    relativesStale: "A TreeViz-adatban m\xE9g nincsenek rokonok. Friss\xEDtsd a TreeViz lapot, hogy \xFAjra elk\xFCldje a f\xE1t.",
    missingFact: "A t\xE9ny nem tal\xE1lhat\xF3 az oldalon.",
    batchDone: "Az Ancestry-friss\xEDt\xE9s k\xE9sz.",
    openApp: "TreeViz megnyit\xE1sa",
    hide: "Elrejt\xE9s",
    showPanel: "Panel megjelen\xEDt\xE9se",
    panelShown: "A panel \xFAjra l\xE1tszik ezen a lapon.",
    panelMissing: "Ezen a lapon nincs TreeViz Connector panel.",
    persons: "{{count}} szem\xE9ly",
    log: "Napl\xF3",
    copyLog: "Napl\xF3 m\xE1sol\xE1sa",
    copiedLog: "Napl\xF3 a v\xE1g\xF3lapon."
  };
  var EN = {
    title: "TreeViz Connector",
    signIn: "Sign in to TreeViz and open the tree in this browser.",
    cached: "TreeViz data has been in this browser since {{time}}.",
    notInTree: "This person is not in the open TreeViz tree.",
    inTree: "This person is in the TreeViz tree: {{tree}}.",
    pickTree: "More than one TreeViz tree contains this person. Pick one.",
    site: "On this site",
    onAncestry: "On Ancestry",
    onMyHeritage: "On MyHeritage",
    treeviz: "TreeViz",
    update: "Write selected fields",
    updateSource: "Update {{source}}",
    updateTree: "Update in TreeViz",
    updatedTree: "Written to TreeViz.",
    addedRelatives: "Added to TreeViz: {{names}}",
    nothingToAdd: "TreeViz already has every name from this page.",
    treeClosed: "Open this tree in TreeViz, then try again.",
    ambiguous: "More than one person in the tree has this name: {{names}}",
    relativesNotWritten: "Relatives are not written to the source site on this layout.",
    warning: "The change stays on this site. TreeViz cannot undo it. Only checked fields are written.",
    layout: "TreeViz Connector does not know this page layout, so it will not write.",
    noDiff: "TreeViz and this site match.",
    openSource: "Open for review",
    compare: "Review this person on the source site.",
    wrote: "Written.",
    failed: "Could not write.",
    openEdit: "Open the editor to compare",
    whichPerson: "Open the person profile, or the editor.",
    offline: "Writing needs a network connection.",
    name: "Name",
    sex: "Sex",
    female: "female",
    male: "male",
    birthDate: "Birth date",
    birthPlace: "Birth place",
    deathDate: "Death date",
    deathPlace: "Death place",
    marriageDate: "Marriage date",
    marriagePlace: "Marriage place",
    parents: "Parents",
    spouses: "Spouses",
    children: "Children",
    fact: "Fact",
    factsStale: "This TreeViz data has no other facts yet. Refresh the TreeViz tab so it sends the tree again.",
    factNotWritten: "This fact is not written to the source site on this layout.",
    relativesStale: "This TreeViz data has no relatives yet. Refresh the TreeViz tab so it sends the tree again.",
    missingFact: "The fact is not on this page.",
    batchDone: "The Ancestry update is finished.",
    openApp: "Open TreeViz",
    hide: "Hide",
    showPanel: "Show the panel",
    panelShown: "The panel is visible on this page again.",
    panelMissing: "This page has no TreeViz Connector panel.",
    persons: "{{count}} people",
    log: "Log",
    copyLog: "Copy log",
    copiedLog: "Log copied."
  };
  var t = (key, vars) => {
    const table = navigator.language.toLowerCase().startsWith("hu") ? HU : EN;
    let text = table[key];
    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        text = text.replaceAll(`{{${name}}}`, value);
      }
    }
    return text;
  };

  // extensions/treeviz-connector/src/log.ts
  var LIMIT = 200;
  var lines = [];
  var listeners = /* @__PURE__ */ new Set();
  var stamp = () => (/* @__PURE__ */ new Date()).toISOString();
  var connectorLog = (scope, message, detail) => {
    const extra = detail === void 0 ? "" : ` ${typeof detail === "string" ? detail : JSON.stringify(detail)}`;
    const line = `${stamp()} [${scope}] ${message}${extra}`;
    lines.push(line);
    if (lines.length > LIMIT) {
      lines.splice(0, lines.length - LIMIT);
    }
    console.info("[TreeViz Connector]", line);
    try {
      chrome.runtime.sendMessage({ type: "connector:log", line }, () => {
        void chrome.runtime.lastError;
      });
    } catch {
    }
    listeners.forEach((listener) => listener());
  };
  var recentLogLines = () => lines.slice(-12);
  var subscribeLog = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  var copyConnectorLog = async () => {
    const remote = await new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "connector:get-log" }, (response) => {
          void chrome.runtime.lastError;
          const body = response ?? {};
          resolve(Array.isArray(body.lines) ? body.lines.map(String) : []);
        });
      } catch {
        resolve([]);
      }
    });
    const merged = [...remote];
    for (const line of lines) {
      if (!merged.includes(line)) {
        merged.push(line);
      }
    }
    const text = merged.join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
    }
    return text;
  };

  // extensions/treeviz-connector/src/match.ts
  var ask = (message) => new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({});
        return;
      }
      resolve(response ?? {});
    });
  });
  var loadIndex = async () => {
    const response = await ask({ type: "connector:get-index" });
    return response.index;
  };
  var matchTrees = (index, source, sourceTreeId, personId) => {
    if (!index) {
      return [];
    }
    const id = personId.replace(/[^\d]/g, "");
    return index.trees.filter((tree) => {
      if (tree.source !== source) {
        return false;
      }
      if (sourceTreeId && tree.sourceTreeId && sourceTreeId.toLowerCase() !== tree.sourceTreeId.toLowerCase()) {
        return false;
      }
      return tree.persons.some((person) => person.sourcePersonId === id);
    });
  };
  var personIn = (tree, personId) => {
    const id = personId.replace(/[^\d]/g, "");
    return tree.persons.find((person) => person.sourcePersonId === id);
  };
  var preferActive = (trees) => {
    if (trees.length === 1) {
      return trees[0];
    }
    return trees.find((tree) => tree.active);
  };

  // extensions/treeviz-connector/src/parse-url.ts
  var MH_PROFILE = /\/profile-([A-Za-z0-9]+)-(\d+)/i;
  var MH_TREE = /\/family-trees\/[^/]+\/([A-Za-z0-9]{16,})/i;
  var parseMyHeritageLocation = (href2) => {
    let url;
    try {
      url = new URL(href2);
    } catch {
      return void 0;
    }
    if (!/myheritage\./i.test(url.hostname)) {
      return void 0;
    }
    const profile = url.pathname.match(MH_PROFILE);
    if (profile) {
      return {
        site: "myheritage",
        siteId: profile[1],
        personId: profile[2],
        kind: "profile"
      };
    }
    if (/edit-profile\.php/i.test(url.pathname)) {
      const siteId = url.searchParams.get("s") || void 0;
      const personId = url.searchParams.get("indID") || url.searchParams.get("individualID") || void 0;
      if (siteId && personId) {
        return { site: "myheritage", siteId, personId, kind: "profile" };
      }
    }
    const tree = url.pathname.match(MH_TREE);
    if (tree) {
      return { site: "myheritage", siteId: tree[1], kind: "tree" };
    }
    return void 0;
  };

  // extensions/treeviz-connector/src/panel.ts
  var HOST_ID = "treeviz-connector-root";
  var HIDDEN_KEY = "treevizConnectorPanelHidden";
  var current = { heading: "" };
  var hidden = false;
  var ready = false;
  var persistHidden = (value) => {
    chrome.storage.local.set({ [HIDDEN_KEY]: value });
  };
  var removeHost = () => {
    document.getElementById(HOST_ID)?.remove();
  };
  var label = (key) => t(key);
  var sourceLabel = () => {
    const host = location.hostname.toLowerCase();
    if (host.includes("ancestry")) {
      return t("onAncestry");
    }
    if (host.includes("myheritage")) {
      return t("onMyHeritage");
    }
    return t("site");
  };
  var sourceProduct = () => {
    const host = location.hostname.toLowerCase();
    if (host.includes("ancestry")) {
      return "Ancestry";
    }
    if (host.includes("myheritage")) {
      return "MyHeritage";
    }
    return "TreeViz";
  };
  var render = (host, model) => {
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
        time: new Date(model.cachedAt).toLocaleString()
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
    const selected = /* @__PURE__ */ new Set();
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
        name.textContent = diff.label || label(diff.key);
        const site = document.createElement("div");
        site.textContent = `${sourceLabel()}: ${diff.site || "\u2014"}`;
        const tree = document.createElement("div");
        tree.textContent = `${t("treeviz")}: ${diff.treeviz || "\u2014"}`;
        const actions = document.createElement("div");
        actions.className = "actions";
        if (model.onUpdateSite && diff.treeviz) {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = t("updateSource", { source: sourceProduct() });
          button.disabled = Boolean(model.busy);
          button.addEventListener("click", () => model.onUpdateSite?.(diff));
          actions.append(button);
        }
        if (model.onUpdateTree && diff.site) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "alt";
          button.textContent = t("updateTree");
          button.disabled = Boolean(model.busy);
          button.addEventListener("click", () => model.onUpdateTree?.(diff));
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
        }, 2e3);
      });
    });
    details.append(summary, pre, copy);
    card.append(details);
    root.append(style, card);
  };
  var showPanel = (model) => {
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
  var patchPanel = (partial) => {
    showPanel({ ...current, ...partial });
  };

  // extensions/treeviz-connector/src/content/myheritage.ts
  var editorDocuments = () => {
    const docs = [document];
    const visit = (doc) => {
      for (const frame of Array.from(doc.querySelectorAll("iframe"))) {
        try {
          const child = frame.contentDocument;
          if (child && !docs.includes(child)) {
            docs.push(child);
            visit(child);
          }
        } catch {
        }
      }
    };
    visit(document);
    return docs;
  };
  var activeForm = () => {
    for (const doc of editorDocuments()) {
      const named = doc.getElementById("editProfileForm");
      if (named instanceof HTMLFormElement) {
        return named;
      }
      const firstName = doc.getElementById("firstName") || doc.querySelector("[name='firstName']");
      const form = firstName?.closest("form");
      if (form instanceof HTMLFormElement) {
        return form;
      }
    }
    return null;
  };
  var valueOf = (id, root = document) => {
    const node = root.querySelector(`#${CSS.escape(id)}`) || root.querySelector(`[name="${CSS.escape(id)}"]`);
    if (node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement) {
      return node.value || "";
    }
    return "";
  };
  var onEditorPage = () => /edit-profile\.php/i.test(window.location.pathname);
  var urlPersonId = () => parseMyHeritageLocation(window.location.href)?.personId?.replace(/[^\d]/g, "") || "";
  var composedDate = (prefix, root = document) => {
    const year = valueOf(`gdp_firstDateYear_${prefix}`, root);
    const month = valueOf(`gdp_firstDateMonth_${prefix}`, root);
    const day = valueOf(`gdp_firstDateDay_${prefix}`, root);
    if (!year || year.toLocaleLowerCase() === "\xE9v" || !/^\d{4}$/.test(year)) {
      return "";
    }
    const monthNumber = Number(month);
    const dayNumber = Number(day);
    if (monthNumber >= 1 && dayNumber >= 1) {
      return `${dayNumber} ${monthNumber} ${year}`;
    }
    if (monthNumber >= 1) {
      return `${monthNumber} ${year}`;
    }
    return year;
  };
  var checkedSex = (form) => {
    const selected = form.querySelector('input[name="gender"]:checked');
    return selected instanceof HTMLInputElement ? selected.value : "";
  };
  var readForm = () => {
    const form = activeForm();
    if (!form) {
      return void 0;
    }
    const individual = valueOf("individualID", form) || urlPersonId();
    if (!individual) {
      return void 0;
    }
    return {
      layoutKnown: true,
      name: `${valueOf("firstName", form)} ${valueOf("lastName", form)}`.trim(),
      sex: checkedSex(form),
      birthDate: composedDate("birthDate", form),
      birthPlace: valueOf("birthPlace", form),
      deathDate: composedDate("deathDate", form),
      deathPlace: valueOf("deathPlace", form),
      marriageDate: composedDate("marriageDate0", form),
      marriagePlace: valueOf("marriagePlace0", form)
    };
  };
  var formPersonId = () => {
    const form = activeForm();
    const field = form ? valueOf("individualID", form) : "";
    return field.replace(/[^\d]/g, "") || urlPersonId();
  };
  var writable = (_key) => true;
  var dateFields = (prefix, raw) => {
    const parsed = parseLooseDate(raw);
    if (!parsed) {
      return [];
    }
    const fields = [
      { id: `gdp_firstDateYear_${prefix}`, value: String(parsed.y) }
    ];
    if (parsed.m) {
      fields.push({ id: `gdp_firstDateMonth_${prefix}`, value: String(parsed.m) });
    }
    if (parsed.d) {
      fields.push({ id: `gdp_firstDateDay_${prefix}`, value: String(parsed.d) });
    }
    return fields;
  };
  var fieldsFor = (person, keys) => {
    const fields = [];
    if (keys.includes("name")) {
      if (person.givenName) {
        fields.push({ id: "firstName", value: person.givenName });
      }
      if (person.surname) {
        fields.push({ id: "lastName", value: person.surname });
      }
    }
    if (keys.includes("sex") && person.sex) {
      const id = person.sex === "M" ? "genderM" : person.sex === "F" ? "genderF" : "genderU";
      fields.push({ id, check: true });
    }
    if (keys.includes("birthDate")) {
      fields.push(...dateFields("birthDate", person.birthDate));
    }
    if (keys.includes("birthPlace") && person.birthPlace) {
      fields.push({ id: "birthPlace", value: person.birthPlace });
    }
    if (keys.includes("deathDate")) {
      fields.push(...dateFields("deathDate", person.deathDate));
    }
    if (keys.includes("deathPlace") && person.deathPlace) {
      fields.push({ id: "deathPlace", value: person.deathPlace });
    }
    if (keys.includes("marriageDate")) {
      fields.push(...dateFields("marriageDate0", person.marriageDate));
    }
    if (keys.includes("marriagePlace") && person.marriagePlace) {
      fields.push({ id: "marriagePlace0", value: person.marriagePlace });
    }
    return fields;
  };
  var openEditor = async (personId, siteId) => {
    if (activeForm() && formPersonId() === personId) {
      return true;
    }
    if (onEditorPage()) {
      return false;
    }
    let link = document.querySelector(
      "#editProfilePageLink, a.PK_popupLink[href*='edit-profile.php']"
    );
    if (!link) {
      const found = document.body.innerHTML.match(
        /edit-profile\.php\?s=([A-Za-z0-9]+)&(?:amp;)?indID=(\d+)/
      );
      if (found) {
        link = document.createElement("a");
        link.href = `${window.location.origin}/FP/edit-profile.php?s=${found[1]}&indID=${personId}&origin=family-tree`;
        link.className = "PK_popupLink";
        link.id = "editProfilePageLink";
        document.body.append(link);
      } else if (siteId) {
        link = document.createElement("a");
        link.href = `${window.location.origin}/FP/edit-profile.php?s=${siteId}&indID=${personId}&origin=ProfilePage`;
        link.className = "PK_popupLink";
        document.body.append(link);
      }
    }
    connectorLog("myheritage", "open editor", {
      personId,
      siteId,
      href: link?.href
    });
    link?.click();
    const started = Date.now();
    while (Date.now() - started < 6e3) {
      if (activeForm() && formPersonId() === personId) {
        return true;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 200));
    }
    const opened = Boolean(activeForm());
    if (!opened) {
      connectorLog("myheritage", "editor did not open", { personId, siteId });
    }
    return opened;
  };
  var showTree = (tree, personId, siteId, cachedAt) => {
    const person = personIn(tree, personId);
    if (!person) {
      showPanel({ heading: t("title"), detail: t("notInTree"), cachedAt });
      return;
    }
    const form = readForm();
    const sameForm = Boolean(
      form && (formPersonId() === personId || onEditorPage() && urlPersonId() === personId)
    );
    const diffs = form && sameForm ? diffPerson(form, person, writable) : [];
    connectorLog("myheritage", "compare", {
      tree: tree.name,
      siteId,
      personId,
      formOpen: Boolean(form),
      formPersonId: formPersonId(),
      sameForm,
      diffs: diffs.map((diff) => ({
        key: diff.key,
        site: diff.site,
        treeviz: diff.treeviz
      }))
    });
    const site = form && sameForm ? form : { layoutKnown: false };
    showPanel({
      heading: t("title"),
      detail: t("inTree", { tree: tree.name }),
      cachedAt,
      diffs: sameForm ? diffs : void 0,
      layoutKnown: sameForm ? true : void 0,
      status: sameForm ? void 0 : t("openEdit"),
      onUpdateSite: sameForm ? (diff) => {
        void writeSelected(person, [diff.key]);
      } : void 0,
      onUpdateTree: (diff) => {
        patchPanel({ busy: true });
        void ask({
          type: "connector:update-treeviz",
          sourcePersonId: person.sourcePersonId,
          sourceTreeId: tree.sourceTreeId,
          key: diff.key,
          label: diff.label,
          site: diff.site,
          treeviz: diff.treeviz
        }).then((response) => {
          const code = String(response.code ?? "");
          const names = String(response.names ?? "");
          const statusText = code === "added" ? t("addedRelatives", { names }) : code === "fact" ? t("updatedTree") : code === "nothing" ? t("nothingToAdd") : code === "ambiguous" ? t("ambiguous", { names }) : t("treeClosed");
          patchPanel({ busy: false, status: statusText });
        });
      },
      onPickTree: void 0
    });
    if (!sameForm) {
      const host = document.getElementById("treeviz-connector-root");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = t("openEdit");
      button.addEventListener("click", () => {
        void openEditor(personId, siteId).then((opened) => {
          if (opened) {
            showTree(tree, personId, siteId, cachedAt);
          } else {
            patchPanel({ status: t("layout") });
          }
        });
      });
      host?.shadowRoot?.querySelector(".card")?.append(button);
    }
  };
  var writeSelected = async (person, keys) => {
    if (!navigator.onLine) {
      patchPanel({ status: t("offline") });
      return;
    }
    const fields = fieldsFor(person, keys);
    document.documentElement.setAttribute(
      "data-treeviz-connector-write",
      JSON.stringify(fields)
    );
    patchPanel({ busy: true });
    connectorLog("myheritage", "write fields", fields.map((field) => field.id));
    const response = await ask({ type: "connector:save-myheritage" });
    const result = document.documentElement.getAttribute("data-treeviz-connector-result");
    connectorLog("myheritage", "write result", { ok: response.ok, result });
    document.documentElement.removeAttribute("data-treeviz-connector-result");
    patchPanel({
      busy: false,
      status: response.ok && result === "ok" ? t("wrote") : t("failed")
    });
  };
  var renderMatch = async () => {
    const location2 = parseMyHeritageLocation(window.location.href);
    if (!location2?.siteId) {
      connectorLog("myheritage", "url is not a tree or profile", window.location.href);
      return;
    }
    const formId = formPersonId();
    const personId = location2.personId || formId;
    if (!personId) {
      showPanel({ heading: t("title"), detail: t("whichPerson") });
      return;
    }
    const index = await loadIndex();
    if (!index) {
      connectorLog("myheritage", "no TreeViz index in this browser");
      showPanel({ heading: t("title"), detail: t("signIn") });
      return;
    }
    connectorLog("myheritage", "page", {
      href: window.location.href,
      kind: location2.kind,
      siteId: location2.siteId,
      personId,
      formPersonId: formId,
      publishedAt: index.publishedAt,
      trees: index.trees.map((tree) => ({
        source: tree.source,
        id: tree.sourceTreeId,
        people: tree.persons.length
      }))
    });
    const trees = matchTrees(index, "myheritage", location2.siteId, personId);
    if (!trees.length) {
      connectorLog("myheritage", "no matching tree");
      showPanel({
        heading: t("title"),
        detail: t("notInTree"),
        cachedAt: index.publishedAt
      });
      return;
    }
    const preferred = preferActive(trees);
    if (!preferred) {
      showPanel({
        heading: t("title"),
        detail: t("pickTree"),
        trees,
        cachedAt: index.publishedAt,
        onPickTree: (tree) => showTree(tree, personId, location2.siteId, index.publishedAt)
      });
      return;
    }
    showTree(preferred, personId, location2.siteId, index.publishedAt);
  };
  var href = "";
  var tick = () => {
    const marker = `${window.location.href}|${formPersonId()}`;
    if (marker === href) {
      return;
    }
    href = marker;
    void renderMatch();
  };
  tick();
  window.setInterval(tick, 1e3);
})();
