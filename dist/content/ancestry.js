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
  var foldName = (value) => collapse(value).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  var FACT_TITLE_ALIASES = {
    aka: "also known as",
    "also known": "also known as",
    "e mail": "email"
  };
  var factTitleKey = (title) => {
    const key = foldName(title);
    return FACT_TITLE_ALIASES[key] || key;
  };
  var sameName = (left, right) => {
    const a = foldName(left);
    const b = foldName(right);
    if (!a || !b) {
      return false;
    }
    if (a === b) {
      return true;
    }
    return a.split(" ").sort().join(" ") === b.split(" ").sort().join(" ");
  };
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
  var diffPerson = (site, person, writable) => {
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
    for (const [key, siteValue2, treeValue2] of pairs) {
      if (!collapse(siteValue2) && !collapse(treeValue2)) {
        continue;
      }
      if (equalFor(key, siteValue2, treeValue2)) {
        continue;
      }
      diffs.push({
        key,
        site: collapse(siteValue2) || void 0,
        treeviz: collapse(treeValue2) || void 0,
        writable: writable(key) && Boolean(collapse(treeValue2))
      });
    }
    return diffs;
  };
  var ancestryDateForInput = (value) => {
    const parsed = parseLooseDate(value);
    if (!parsed) {
      return collapse(value);
    }
    const month = [
      "",
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec"
    ];
    if (parsed.d && parsed.m) {
      return `${parsed.d} ${month[parsed.m]} ${parsed.y}`;
    }
    if (parsed.m) {
      return `${month[parsed.m]} ${parsed.y}`;
    }
    return String(parsed.y);
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

  // extensions/treeviz-connector/src/ancestry-writer.ts
  var TITLE_ALIASES = {
    birth: ["birth", "sz\xFClet\xE9s", "szuletes", "geburt", "naissance", "nacimiento", "nascita"],
    death: ["death", "hal\xE1l", "halal", "tod", "d\xE9c\xE8s", "deces", "defunci\xF3n", "defuncion", "morte"],
    marriage: [
      "marriage",
      "h\xE1zass\xE1g",
      "hazassag",
      "heirat",
      "mariage",
      "matrimonio",
      "casamiento"
    ]
  };
  var aliasKey = (type) => {
    const text = type.trim().toLocaleLowerCase();
    for (const [key, names] of Object.entries(TITLE_ALIASES)) {
      if (names.includes(text) || text === key) {
        return key;
      }
    }
    return text;
  };
  var titleMatches = (cardTitle, type) => {
    const card = cardTitle.trim().toLocaleLowerCase().replace(/\s*\(alternate\)\s*$/i, "");
    const wanted = aliasKey(type);
    if (aliasKey(cardTitle) === wanted) {
      return true;
    }
    return card === type.trim().toLocaleLowerCase();
  };
  var readAncestryCards = (doc) => {
    return Array.from(doc.querySelectorAll("#researchListFacts li.researchListItem")).map(
      (node) => {
        const root = node;
        return {
          root,
          title: root.querySelector(".userCardTitle")?.textContent?.trim() || "",
          date: root.querySelector(".factItemDate")?.textContent?.trim() || "",
          place: root.querySelector(".factItemLocation")?.textContent?.trim() || "",
          subtitle: root.querySelector(".userCardSubTitle")?.textContent?.trim() || Array.from(root.querySelectorAll(".textWrap")).map((item) => item.textContent?.trim() || "").filter(Boolean).join(", ")
        };
      }
    );
  };
  var ancestryLayoutKnown = (doc) => Boolean(doc.querySelector("#researchListFacts"));
  var findCard = (cards, type, date, place) => cards.find((card) => {
    if (!titleMatches(card.title, type)) {
      return false;
    }
    const dateOk = !date || sameDate(card.date, date) || sameText(card.date, date);
    const placeOk = !place || sameText(card.place, place);
    return dateOk && placeOk;
  });
  var setInput = (input, value) => {
    const prototype = Object.getPrototypeOf(input);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    descriptor?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(
      new FocusEvent("focusout", { bubbles: true, cancelable: true })
    );
  };
  var waitFor = async (read, kick, timeoutMs) => {
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
        attributes: true
      });
      kick();
    });
  };
  var editCard = async (card, to) => {
    const life = card.root.querySelector(".card.LifeEvent");
    if (!life) {
      throw new Error("no-card");
    }
    const editButton = await waitFor(
      () => {
        const button = life.querySelector("button.cardAction");
        if (life.classList.contains("cardSelected") && button) {
          return button;
        }
        return void 0;
      },
      () => life.click(),
      5e3
    );
    const modal = await waitFor(
      () => {
        const fact = document.querySelector("#FactEditComponent")?.closest(".modalFlex");
        const date = fact?.querySelector("input#date");
        const location2 = fact?.querySelector("input#location");
        if (fact?.classList.contains("open") && date && location2) {
          return { fact, date, location: location2 };
        }
        return void 0;
      },
      () => editButton.click(),
      5e3
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
        return button instanceof HTMLButtonElement ? button : void 0;
      },
      () => void 0,
      5e3
    );
    await waitFor(
      () => modal.fact.querySelector(
        ".factEditFooter .editModalSaveButton[disabled]"
      ),
      () => save.click(),
      8e3
    );
    const close = modal.fact.querySelector("button.modalClose");
    close?.click();
  };
  var writeAncestryFacts = async (facts) => {
    const errors = [];
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
          titles: readAncestryCards(document).map((item) => item.title)
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
          message
        });
        errors.push(`${fact.type}: ${message}`);
      }
    }
    return errors;
  };
  var checkAncestryFacts = (facts) => {
    const cards = readAncestryCards(document);
    return facts.filter((fact) => !findCard(cards, fact.type, fact.from.date, fact.from.place)).map((fact) => fact.type);
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

  // extensions/treeviz-connector/src/page-facts.ts
  var SKIP_TITLES = /* @__PURE__ */ new Set([
    "name",
    "nev",
    "gender",
    "sex",
    "nem",
    "birth",
    "death",
    "marriage",
    "parents",
    "spouse and children",
    "relationships",
    "timeline",
    "sources",
    "facts",
    "filter",
    "add",
    "filteradd",
    "select fact",
    "selectfact",
    "edit",
    "search",
    "more",
    "life story",
    "gallery",
    "hints",
    "media",
    "story",
    "nothing to see yet",
    "stay tuned"
  ]);
  var LIFE_HEADER = /^(birth|szuletes|death|halal|marriage|hazassag|baptism|burial|christening|gender|sex|name|nev|nem)\b/;
  var chromeLine = (line) => {
    const key = foldName(line);
    const squashed = key.replace(/\s+/g, "");
    return SKIP_TITLES.has(key) || SKIP_TITLES.has(squashed);
  };
  var factText = (el) => {
    const clone = el.cloneNode(true);
    clone.querySelectorAll(
      "button, select, option, label, nav, script, style, [role='button'], [role='tab'], [role='tablist'], [role='combobox'], [role='menu'], [role='toolbar']"
    ).forEach((node) => node.remove());
    return clone.innerText?.trim() ?? "";
  };
  var readLooseFacts = (doc, skipWithin) => {
    const facts = [];
    const seen = /* @__PURE__ */ new Set();
    doc.querySelectorAll("div, li, article, section").forEach((node) => {
      const el = node;
      if (el.closest("#treeviz-connector-root") || skipWithin && skipWithin.contains(el)) {
        return;
      }
      const text = factText(el);
      if (!text || text.length > 140 || !text.includes("\n")) {
        return;
      }
      if (Array.from(el.children).some((child) => factText(child) === text)) {
        return;
      }
      const lines2 = text.split("\n").map((line) => line.trim()).filter((line) => line && !chromeLine(line));
      if (lines2.length < 2 || lines2.length > 4) {
        return;
      }
      const title = lines2[0].replace(/\s+edit$/i, "").trim();
      if (!title || title.length > 40 || chromeLine(title) || LIFE_HEADER.test(foldName(title))) {
        return;
      }
      if (/\bof\s+(?:a\s+|an\s+|the\s+)?(?:son|daughter|child|father|mother|husband|wife|spouse|parent)\b/i.test(
        title
      )) {
        return;
      }
      if (lines2.slice(1).some((line) => LIFE_HEADER.test(foldName(line)) || chromeLine(line))) {
        return;
      }
      const value = lines2.slice(1).join(", ").trim();
      if (!value || value.length > 100) {
        return;
      }
      const id = `${foldName(title)}|${foldName(value)}`;
      if (seen.has(id)) {
        return;
      }
      seen.add(id);
      facts.push({ title, value });
    });
    return facts;
  };

  // extensions/treeviz-connector/src/parse-url.ts
  var ANCESTRY_PERSON = /\/family-tree\/person\/tree\/(\d+)\/person\/(\d+)/;
  var ANCESTRY_TREE = /\/family-tree\/tree\/(\d+)/;
  var parseAncestryLocation = (href2) => {
    let url;
    try {
      url = new URL(href2);
    } catch {
      return void 0;
    }
    const person = url.pathname.match(ANCESTRY_PERSON);
    if (person) {
      return { site: "ancestry", treeId: person[1], personId: person[2] };
    }
    const tree = url.pathname.match(ANCESTRY_TREE);
    const fpid = url.searchParams.get("fpid") || url.searchParams.get("cfpid");
    if (tree && fpid && /^\d+$/.test(fpid)) {
      return { site: "ancestry", treeId: tree[1], personId: fpid };
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

  // extensions/treeviz-connector/src/content/ancestry.ts
  var cardText = (cards, aliases) => cards.find((card) => aliases.includes(card.title.toLocaleLowerCase()));
  var valueUnderLabel = (labels) => {
    let best;
    document.querySelectorAll("div, section, li, article").forEach((node) => {
      const text = node.innerText?.trim();
      if (!text || text.length > 90 || !text.includes("\n")) {
        return;
      }
      const lines2 = text.split("\n").map((line) => line.trim()).filter(Boolean);
      if (lines2.length < 2 || !labels.includes(lines2[0].toLocaleLowerCase())) {
        return;
      }
      if (!best || text.length < best.length) {
        best = { length: text.length, value: lines2.slice(1).join(", ") };
      }
    });
    return best?.value;
  };
  var splitFactLine = (value) => {
    if (!value) {
      return {};
    }
    if (/\d{3,4}/.test(value) && value.includes(",")) {
      const [date, ...rest] = value.split(",");
      return { date: date.trim(), place: rest.join(",").trim() };
    }
    if (/\d{3,4}/.test(value) || /unknown|ismeretlen/i.test(value)) {
      return { date: value };
    }
    return { place: value };
  };
  var siteFacts = () => {
    const layoutKnown = ancestryLayoutKnown(document);
    const cards = readAncestryCards(document);
    const name = cardText(cards, ["name", "n\xE9v", "nev", "nom", "nombre"]);
    const sex = cardText(cards, ["gender", "nem", "geschlecht", "sexe", "sexo"]);
    const birth = cardText(cards, ["birth", "sz\xFClet\xE9s", "szuletes", "geburt", "naissance", "nacimiento"]);
    const death = cardText(cards, ["death", "hal\xE1l", "halal", "tod", "d\xE9c\xE8s", "deces", "defunci\xF3n"]);
    const marriage = cardText(cards, ["marriage", "h\xE1zass\xE1g", "hazassag", "heirat", "mariage", "matrimonio"]);
    const looseBirth = splitFactLine(
      valueUnderLabel(["birth", "sz\xFClet\xE9s", "szuletes", "geburt", "naissance", "nacimiento"])
    );
    const looseDeath = splitFactLine(
      valueUnderLabel(["death", "hal\xE1l", "halal", "tod", "d\xE9c\xE8s", "deces", "defunci\xF3n"])
    );
    const looseMarriage = splitFactLine(
      valueUnderLabel(["marriage", "h\xE1zass\xE1g", "hazassag", "heirat", "mariage", "matrimonio"])
    );
    return {
      layoutKnown,
      name: name?.subtitle || valueUnderLabel(["name", "n\xE9v", "nev", "nom", "nombre"]),
      sex: sex?.subtitle || valueUnderLabel(["gender", "sex", "nem", "geschlecht", "sexe", "sexo"]),
      birthDate: birth?.date || looseBirth.date,
      birthPlace: birth?.place || looseBirth.place,
      deathDate: death?.date || looseDeath.date,
      deathPlace: death?.place || looseDeath.place,
      marriageDate: marriage?.date || looseMarriage.date,
      marriagePlace: marriage?.place || looseMarriage.place
    };
  };
  var writableOnAncestry = (key) => ancestryLayoutKnown(document) && (key === "birthDate" || key === "birthPlace" || key === "deathDate" || key === "deathPlace" || key === "marriageDate" || key === "marriagePlace");
  var factType = (key) => {
    if (key.startsWith("birth")) return "Birth";
    if (key.startsWith("death")) return "Death";
    return "Marriage";
  };
  var writeSelected = async (person, site, keys) => {
    if (!navigator.onLine) {
      patchPanel({ status: t("offline") });
      return;
    }
    const facts = keys.filter(writableOnAncestry).map((key) => {
      const kind = key.endsWith("Date") ? "date" : "place";
      const fromDate = kind === "date" ? siteValue(site, key) : dateSibling(site, key);
      const fromPlace = kind === "place" ? siteValue(site, key) : placeSibling(site, key);
      const toDate = kind === "date" ? treeValue(person, key) : dateSiblingTree(person, key);
      const toPlace = kind === "place" ? treeValue(person, key) : placeSiblingTree(person, key);
      return {
        type: factType(key),
        from: { date: fromDate, place: fromPlace },
        to: { date: toDate, place: toPlace }
      };
    });
    const merged = /* @__PURE__ */ new Map();
    for (const fact of facts) {
      const existing = merged.get(fact.type);
      if (!existing) {
        merged.set(fact.type, fact);
        continue;
      }
      existing.to.date = fact.to.date || existing.to.date;
      existing.to.place = fact.to.place || existing.to.place;
      existing.from.date = fact.from.date || existing.from.date;
      existing.from.place = fact.from.place || existing.from.place;
    }
    patchPanel({ busy: true, status: t("update") });
    connectorLog("ancestry", "write start", [...merged.values()]);
    const errors = await writeAncestryFacts([...merged.values()]);
    connectorLog("ancestry", "write done", errors);
    patchPanel({
      busy: false,
      status: errors.length ? `${t("failed")} ${errors.join(", ")}` : t("wrote")
    });
  };
  var siteValue = (site, key) => {
    const value = site[key];
    return typeof value === "string" ? value : void 0;
  };
  var treeValue = (person, key) => {
    const value = person[key];
    return typeof value === "string" ? value : void 0;
  };
  var leafHeading = (root, labels) => {
    let found;
    root.querySelectorAll("h1,h2,h3,h4,h5,div,span,p").forEach((node) => {
      const el = node;
      const text = el.innerText?.trim() ?? "";
      if (!labels.includes(text.toLocaleLowerCase()) || text.length > 40) {
        return;
      }
      if (!found || el.innerText.length < found.innerText.length) {
        found = el;
      }
    });
    return found;
  };
  var relationshipsRoot = () => {
    const heading = leafHeading(document, [
      "relationships",
      "kapcsolatok",
      "verwandtschaft",
      "relations",
      "relazioni",
      "relaciones"
    ]);
    let node = heading?.parentElement;
    while (node && node !== document.body) {
      const text = node.innerText?.toLocaleLowerCase() ?? "";
      if (text.includes("parents") || text.includes("sz\xFCl\u0151k") || text.includes("szulok")) {
        return node;
      }
      node = node.parentElement;
    }
    return void 0;
  };
  var cleanRelativeName = (value) => value.split("\n")[0].trim().replace(/^(?:edit|szerkesztés|szerkesztes|bearbeiten|modifier|modifica|editar)(?=\p{Lu})/iu, "").replace(/\s*\d{3,4}\s*[–—-].*$/, "").replace(/\d{3,4}\s*[–—-].*$/, "").replace(/\s*\(\d{3,4}[^)]*\)\s*$/, "").trim();
  var ACTION_LABEL = /^(edit|szerkesztés|szerkesztes|bearbeiten|modifier|modifica|editar|view|megtekintés)$/i;
  var visibleName = (anchor) => {
    const parts = [];
    const walker = document.createTreeWalker(anchor, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const parent = node.parentElement;
      if (parent?.closest("button, [role='button']")) {
        node = walker.nextNode();
        continue;
      }
      const text = node.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (text && !ACTION_LABEL.test(text) && !LIFESPAN.test(text)) {
        parts.push(text);
      }
      node = walker.nextNode();
    }
    return cleanRelativeName(parts.join(" ") || anchor.textContent || "");
  };
  var LIFESPAN = /^(abt\.?|about|ca\.?|c\.|cir\.?|circa|bef\.?|before|aft\.?|after|est\.?|cal\.?)?\s*\d{3,4}(\s*[–—-]\s*(\d{3,4})?)?$/i;
  var personAnchors = (root, start, stop) => {
    const found = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    walker.currentNode = start;
    let node = walker.nextNode();
    while (node) {
      const el = node;
      const text = (el.innerText || "").trim();
      const first = text.split("\n")[0]?.trim().toLocaleLowerCase() ?? "";
      if (text.length < 80 && stop.includes(first)) {
        break;
      }
      const href2 = el.getAttribute("href") || "";
      if (el instanceof HTMLAnchorElement && /\/person\/\d+/.test(href2)) {
        found.push(el);
      }
      node = walker.nextNode();
    }
    return found;
  };
  var cardLines = (el) => {
    let node = el;
    while (node.parentElement) {
      const parent = node.parentElement;
      const links = parent.querySelectorAll("a[href*='/person/']");
      if (links.length !== 1 || (parent.innerText || "").length > 140) {
        break;
      }
      node = parent;
    }
    return (node.innerText || "").split("\n").map((line) => line.trim()).filter(Boolean);
  };
  var pushRelative = (people, person) => {
    if (!person.name || person.name.length >= 80 || people.some((item) => item.name === person.name)) {
      return;
    }
    people.push(person);
  };
  var personCard = (anchor) => {
    let node = anchor;
    while (node.parentElement) {
      const parent = node.parentElement;
      if (parent.querySelectorAll("a[href*='/person/']").length !== 1) {
        break;
      }
      if ((parent.innerText || "").length > 220) {
        break;
      }
      node = parent;
    }
    return node;
  };
  var sexOf = (anchor) => {
    const chunks = [];
    const card = personCard(anchor);
    card.querySelectorAll("*").forEach((node) => {
      for (const name of ["aria-label", "title", "alt", "src", "href", "class"]) {
        const value = node.getAttribute?.(name);
        if (value) {
          chunks.push(value);
        }
      }
      const image = getComputedStyle(node).backgroundImage;
      if (image && image !== "none") {
        chunks.push(image);
      }
    });
    const blob = chunks.join(" ").toLocaleLowerCase();
    const female = /\b(female|woman|weiblich|mujer|femme|nő|no)\b/.test(blob) || /gender[_-]?f\b|silhouette[_-]f|_f_|\/f\//.test(blob);
    const male = /\b(male|man|männlich|hombre|homme|férfi|ferfi)\b/.test(blob) || /gender[_-]?m\b|silhouette[_-]m|_m_|\/m\//.test(blob);
    if (female && !male) {
      return "F";
    }
    if (male && !female) {
      return "M";
    }
    return void 0;
  };
  var relativeFrom = (anchor) => ({
    name: visibleName(anchor),
    sex: sexOf(anchor)
  });
  var namesAfter = (root, start, stop) => {
    const people = [];
    for (const anchor of personAnchors(root, start, stop)) {
      pushRelative(people, relativeFrom(anchor));
    }
    return people;
  };
  var splitHousehold = (root, start) => {
    const anchors = personAnchors(root, start, []);
    const spouses = [];
    const children = [];
    for (const anchor of anchors) {
      const lines2 = cardLines(anchor);
      const lifespan = lines2.slice(1).some((line) => LIFESPAN.test(line));
      let nested = false;
      let node = anchor.parentElement;
      while (node && node !== root) {
        const inside = anchors.filter((item) => node?.contains(item));
        const firstLine = cleanRelativeName((node.innerText || "").split("\n")[0] || "");
        const firstName = inside[0] ? visibleName(inside[0]) : "";
        if (inside.length > 1 && inside[0] !== anchor && firstLine && firstLine === firstName) {
          nested = true;
          break;
        }
        node = node.parentElement;
      }
      pushRelative(lifespan || nested ? children : spouses, relativeFrom(anchor));
    }
    return { spouses, children };
  };
  var PARENT_LABELS = ["parents", "sz\xFCl\u0151k", "szulok", "eltern", "parents", "genitori", "padres"];
  var HOUSEHOLD_LABELS = [
    "spouse and children",
    "spouses and children",
    "spouse",
    "h\xE1zast\xE1rs \xE9s gyerekek",
    "h\xE1zast\xE1rsak \xE9s gyermekek",
    "h\xE1zast\xE1rs \xE9s gyermekek",
    "ehepartner und kinder",
    "conjoint et enfants",
    "coniuge e figli",
    "c\xF3nyuge e hijos"
  ];
  var sectionLines = (heading, stop) => {
    const lines2 = (heading.parentElement?.innerText || "").split("\n").map((line) => line.trim()).filter(Boolean);
    const label2 = heading.innerText.trim().toLocaleLowerCase();
    const start = lines2.findIndex((line) => line.toLocaleLowerCase() === label2);
    const kept = [];
    for (const line of lines2.slice(start + 1)) {
      const key = line.toLocaleLowerCase();
      if (stop.includes(key)) {
        break;
      }
      if (/^(add|search)\b/i.test(line) || /hozzáad|hozzaad/i.test(line) || ACTION_LABEL.test(line) || line.length > 60) {
        continue;
      }
      kept.push(line);
    }
    return kept;
  };
  var linesAfter = (heading, stop) => {
    const people = [];
    for (const line of sectionLines(heading, stop)) {
      if (LIFESPAN.test(line)) {
        continue;
      }
      pushRelative(people, { name: cleanRelativeName(line) });
    }
    return people;
  };
  var splitLines = (lines2) => {
    const spouses = [];
    const children = [];
    for (let index = 0; index < lines2.length; index += 1) {
      const line = lines2[index];
      if (LIFESPAN.test(line)) {
        continue;
      }
      const name = cleanRelativeName(line);
      if (!name) {
        continue;
      }
      const next = lines2[index + 1];
      pushRelative(next && LIFESPAN.test(next) ? children : spouses, { name });
    }
    return { spouses, children };
  };
  var SPOUSE_AND_CHILDREN = /* @__PURE__ */ new Set([
    "spouse and children",
    "spouses and children",
    "spouse/partner and children",
    "spouses/partners and children",
    "h\xE1zast\xE1rs \xE9s gyerekek",
    "h\xE1zast\xE1rsak \xE9s gyermekek",
    "h\xE1zast\xE1rs \xE9s gyermekek"
  ]);
  var SPOUSE_ONLY = /* @__PURE__ */ new Set([
    "spouse",
    "spouses",
    "spouse/partner",
    "spouses/partners",
    "h\xE1zast\xE1rs",
    "h\xE1zast\xE1rsak"
  ]);
  var readFamilyLists = (root) => {
    const spouses = [];
    const children = [];
    let found = false;
    root.querySelectorAll("h2, h3, h4").forEach((heading) => {
      const title = (heading.textContent || "").trim().toLocaleLowerCase();
      const withChildren = SPOUSE_AND_CHILDREN.has(title);
      const spousesOnly = SPOUSE_ONLY.has(title);
      if (!withChildren && !spousesOnly) {
        return;
      }
      const list = heading.nextElementSibling;
      if (!list || list.tagName !== "UL") {
        return;
      }
      found = true;
      Array.from(list.children).forEach((item) => {
        if (item.tagName !== "LI") {
          return;
        }
        const nested = Array.from(item.children).find((child) => child.tagName === "UL");
        const topLink = Array.from(item.querySelectorAll("a[href*='/person/']")).find(
          (anchor) => !nested || !nested.contains(anchor)
        );
        const childRow = withChildren && (item.classList.contains("researchListItemIndented") || Boolean(nested));
        if (topLink) {
          pushRelative(childRow && !nested ? children : spouses, relativeFrom(topLink));
        }
        if (withChildren && nested) {
          nested.querySelectorAll("a[href*='/person/']").forEach((anchor) => {
            pushRelative(children, relativeFrom(anchor));
          });
        }
      });
    });
    return { spouses, children, found };
  };
  var readRelatives = () => {
    const empty = {
      parents: [],
      spouses: [],
      children: [],
      parentsFound: false,
      householdFound: false
    };
    const root = relationshipsRoot();
    if (!root) {
      return empty;
    }
    const parentsHeading = leafHeading(root, PARENT_LABELS);
    const familyLists = readFamilyLists(root);
    const householdHeading = familyLists.found ? void 0 : leafHeading(root, HOUSEHOLD_LABELS);
    const parents = parentsHeading ? namesAfter(root, parentsHeading, HOUSEHOLD_LABELS) : [];
    if (familyLists.found) {
      return {
        parents,
        spouses: familyLists.spouses,
        children: familyLists.children,
        parentsFound: Boolean(parentsHeading),
        householdFound: true
      };
    }
    const linked = householdHeading ? splitHousehold(root, householdHeading) : { spouses: [], children: [] };
    const fromLines = householdHeading && !linked.spouses.length && !linked.children.length ? splitLines(sectionLines(householdHeading, [])) : linked;
    return {
      parents: parents.length || !parentsHeading ? parents : linesAfter(parentsHeading, HOUSEHOLD_LABELS),
      spouses: fromLines.spouses,
      children: fromLines.children,
      parentsFound: Boolean(parentsHeading),
      householdFound: Boolean(householdHeading)
    };
  };
  var LIFE_FACT = /^(birth|szuletes|death|halal|marriage|hazassag|baptism|burial|christening|gender|sex|name|nev|nem)\b/;
  var readPageFacts = () => {
    const facts = [];
    const seen = /* @__PURE__ */ new Set();
    const push = (title, value) => {
      const cleanTitle = title.trim();
      const cleanValue = value.trim();
      if (!cleanTitle || !cleanValue || LIFE_FACT.test(foldName(cleanTitle))) {
        return;
      }
      const id = `${factTitleKey(cleanTitle)}|${foldName(cleanValue)}`;
      if (seen.has(id)) {
        return;
      }
      seen.add(id);
      facts.push({ title: cleanTitle, value: cleanValue });
    };
    for (const card of readAncestryCards(document)) {
      push(card.title, [card.subtitle, card.date, card.place].filter(Boolean).join(", "));
    }
    for (const fact of readLooseFacts(document, relationshipsRoot())) {
      push(fact.title, fact.value);
    }
    return facts;
  };
  var factDiffs = (siteFacts2, treeFacts) => {
    const titles = /* @__PURE__ */ new Map();
    for (const fact of [...siteFacts2, ...treeFacts]) {
      const key = factTitleKey(fact.title);
      if (key && !titles.has(key)) {
        titles.set(key, fact.title);
      }
    }
    const diffs = [];
    for (const [key, title] of titles) {
      const siteValues = siteFacts2.filter((fact) => factTitleKey(fact.title) === key).map((fact) => fact.value);
      const treeValues = treeFacts.filter((fact) => factTitleKey(fact.title) === key).map((fact) => fact.value);
      for (const value of siteValues) {
        if (treeValues.some((treeValue2) => sameName(treeValue2, value))) {
          continue;
        }
        diffs.push({ key: "fact", label: title, site: value, writable: false });
      }
      for (const value of treeValues) {
        if (siteValues.some((siteValue2) => sameName(siteValue2, value))) {
          continue;
        }
        diffs.push({ key: "fact", label: title, treeviz: value, writable: false });
      }
    }
    return diffs;
  };
  var treeRelatives = (tree, ids) => (ids ?? []).map((id) => {
    const found = personIn(tree, id);
    const sex = found?.sex === "M" || found?.sex === "F" ? found.sex : void 0;
    return { name: found?.name || id, sex };
  });
  var sexWord = (sex) => sex === "F" ? t("female") : sex === "M" ? t("male") : "";
  var relativeDiff = (key, sitePeople, treePeople) => {
    const siteOnly = sitePeople.filter(
      (sitePerson) => !treePeople.some((treePerson) => sameName(treePerson.name, sitePerson.name))
    );
    const treeOnly = treePeople.filter(
      (treePerson) => !sitePeople.some((sitePerson) => sameName(sitePerson.name, treePerson.name))
    );
    const sexMismatch = sitePeople.filter((sitePerson) => {
      const match = treePeople.find((treePerson) => sameName(treePerson.name, sitePerson.name));
      return Boolean(match && sitePerson.sex && match.sex !== sitePerson.sex);
    });
    if (!siteOnly.length && !treeOnly.length && !sexMismatch.length) {
      return void 0;
    }
    const siteLabel = (person) => person.sex ? `${person.name} (${sexWord(person.sex)})` : person.name;
    return {
      key,
      site: [...siteOnly, ...sexMismatch].map(siteLabel).join(", ") || void 0,
      treeviz: [...treeOnly.map((person) => person.name), ...sexMismatch.map((person) => person.name)].join(", ") || void 0,
      writable: false
    };
  };
  var dateSibling = (site, key) => {
    if (key.startsWith("birth")) return site.birthDate;
    if (key.startsWith("death")) return site.deathDate;
    return site.marriageDate;
  };
  var placeSibling = (site, key) => {
    if (key.startsWith("birth")) return site.birthPlace;
    if (key.startsWith("death")) return site.deathPlace;
    return site.marriagePlace;
  };
  var dateSiblingTree = (person, key) => {
    if (key.startsWith("birth")) return person.birthDate;
    if (key.startsWith("death")) return person.deathDate;
    return person.marriageDate;
  };
  var placeSiblingTree = (person, key) => {
    if (key.startsWith("birth")) return person.birthPlace;
    if (key.startsWith("death")) return person.deathPlace;
    return person.marriagePlace;
  };
  var showTree = (tree, personId, cachedAt) => {
    const person = personIn(tree, personId);
    if (!person) {
      showPanel({ heading: t("title"), detail: t("notInTree"), cachedAt });
      return;
    }
    const site = siteFacts();
    const relatives = readRelatives();
    const pageFacts = readPageFacts();
    const factsKnown = Array.isArray(person.facts);
    const diffs = diffPerson(site, person, writableOnAncestry);
    if (factsKnown) {
      diffs.push(...factDiffs(pageFacts, person.facts ?? []));
    }
    const relativesKnown = Array.isArray(person.parentIds);
    if (relativesKnown && relatives.parentsFound) {
      const parentDiff = relativeDiff(
        "parents",
        relatives.parents,
        treeRelatives(tree, person.parentIds)
      );
      if (parentDiff) {
        diffs.push(parentDiff);
      }
    }
    if (relativesKnown && relatives.householdFound) {
      const spouseDiff = relativeDiff(
        "spouses",
        relatives.spouses,
        treeRelatives(tree, person.spouseIds)
      );
      const childDiff = relativeDiff(
        "children",
        relatives.children,
        treeRelatives(tree, person.childIds)
      );
      if (spouseDiff) {
        diffs.push(spouseDiff);
      }
      if (childDiff) {
        diffs.push(childDiff);
      }
    }
    void ask({
      type: "connector:save-site",
      snapshot: {
        source: "ancestry",
        sourceTreeId: tree.sourceTreeId ?? "",
        sourcePersonId: person.sourcePersonId,
        readAt: Date.now(),
        layoutKnown: Boolean(site.layoutKnown),
        diffs
      }
    });
    connectorLog("ancestry", "compare", {
      tree: tree.name,
      treeId: tree.sourceTreeId,
      personId,
      layout: site.layoutKnown,
      facts: Boolean(document.querySelector("#researchListFacts")),
      edit: Boolean(document.querySelector("#FactEditComponent")),
      relatives,
      relativesKnown,
      pageFacts,
      factsKnown,
      diffs: diffs.map((diff) => ({
        key: diff.key,
        site: diff.site,
        treeviz: diff.treeviz,
        writable: diff.writable
      }))
    });
    showPanel({
      heading: t("title"),
      detail: t("inTree", { tree: tree.name }),
      cachedAt,
      diffs,
      relativesNote: [
        !relativesKnown && (relatives.parentsFound || relatives.householdFound) ? t("relativesStale") : "",
        !factsKnown && pageFacts.length ? t("factsStale") : ""
      ].filter(Boolean).join(" "),
      layoutKnown: site.layoutKnown,
      onUpdateSite: (diff) => {
        if (diff.key === "parents" || diff.key === "spouses" || diff.key === "children") {
          patchPanel({ status: t("relativesNotWritten") });
          return;
        }
        if (diff.key === "fact") {
          patchPanel({ status: t("factNotWritten") });
          return;
        }
        if (!writableOnAncestry(diff.key)) {
          patchPanel({ status: t("layout") });
          return;
        }
        void writeSelected(person, site, [diff.key]);
      },
      onUpdateTree: (diff) => {
        patchPanel({ busy: true });
        const people = diff.key === "parents" ? relatives.parents : diff.key === "spouses" ? relatives.spouses : diff.key === "children" ? relatives.children : void 0;
        void ask({
          type: "connector:update-treeviz",
          sourcePersonId: person.sourcePersonId,
          sourceTreeId: tree.sourceTreeId,
          key: diff.key,
          label: diff.label,
          site: diff.site,
          treeviz: diff.treeviz,
          people
        }).then((response) => {
          const code = String(response.code ?? "");
          const names = String(response.names ?? "");
          const statusText = code === "added" ? t("addedRelatives", { names }) : code === "fact" ? t("updatedTree") : code === "nothing" ? t("nothingToAdd") : code === "ambiguous" ? t("ambiguous", { names }) : t("treeClosed");
          patchPanel({ busy: false, status: statusText });
        });
      }
    });
  };
  var renderMatch = async () => {
    const location2 = parseAncestryLocation(window.location.href);
    if (!location2) {
      connectorLog("ancestry", "url is not a person page", window.location.href);
      return;
    }
    const index = await loadIndex();
    connectorLog("ancestry", "page", {
      href: window.location.href,
      treeId: location2.treeId,
      personId: location2.personId,
      index: Boolean(index),
      publishedAt: index?.publishedAt,
      trees: index?.trees.map((tree) => ({
        source: tree.source,
        id: tree.sourceTreeId,
        people: tree.persons.length,
        active: tree.active
      }))
    });
    if (!index) {
      connectorLog("ancestry", "no TreeViz index in this browser");
      showPanel({ heading: t("title"), detail: t("signIn") });
      return;
    }
    const trees = matchTrees(index, "ancestry", location2.treeId, location2.personId);
    if (!trees.length) {
      connectorLog("ancestry", "no matching tree");
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
        cachedAt: index.publishedAt,
        trees,
        onPickTree: (tree) => showTree(tree, location2.personId, index.publishedAt)
      });
      return;
    }
    showTree(preferred, location2.personId, index.publishedAt);
  };
  var batchRunning = false;
  var runBatch = async () => {
    if (batchRunning) {
      return;
    }
    batchRunning = true;
    try {
      await runBatchOnce();
    } finally {
      batchRunning = false;
    }
  };
  var runBatchOnce = async () => {
    const location2 = parseAncestryLocation(window.location.href);
    if (!location2) {
      return;
    }
    const response = await ask({
      type: "connector:batch-for-page",
      treeId: location2.treeId,
      personId: location2.personId
    });
    const person = response.person;
    if (!person) {
      return;
    }
    connectorLog("ancestry", "batch person", {
      treeId: person.treeId,
      personId: person.personId,
      facts: person.facts.length
    });
    if (!ancestryLayoutKnown(document)) {
      await ask({
        type: "connector:batch-advance",
        errors: [`${person.personId}: layout`]
      });
      return;
    }
    const missing = checkAncestryFacts(person.facts);
    if (missing.length) {
      showPanel({
        heading: t("title"),
        detail: t("missingFact"),
        status: missing.join(", ")
      });
      await ask({
        type: "connector:batch-advance",
        errors: missing.map((type) => `${person.personId} ${type}`)
      });
      return;
    }
    const errors = await writeAncestryFacts(person.facts);
    connectorLog("ancestry", "batch write", errors);
    const next = await ask({ type: "connector:batch-advance", errors });
    if (next.done) {
      const all = next.errors ?? errors;
      showPanel({
        heading: t("title"),
        detail: t("batchDone"),
        status: all.length ? all.join("; ") : t("wrote")
      });
    }
  };
  var href = "";
  var tick = () => {
    if (window.location.href === href) {
      return;
    }
    href = window.location.href;
    void renderMatch().then(() => runBatch());
  };
  chrome.runtime.onMessage.addListener((message) => {
    const body = message;
    if (body?.type === "connector:run-batch") {
      void runBatch();
    }
  });
  tick();
  window.setInterval(tick, 1e3);
})();
