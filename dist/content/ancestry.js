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
    const numbers = [];
    for (const token of tokens) {
      if (MONTHS[token]) {
        month = MONTHS[token];
        continue;
      }
      if (/^\d{1,2}$/.test(token) && token !== yearMatch[0]) {
        const n = Number(token);
        if (n >= 1 && n <= 31) {
          numbers.push(n);
        }
      }
    }
    if (month) {
      day = numbers.find((n) => n >= 1 && n <= 31);
    } else if (numbers.length >= 2) {
      const [first, second] = numbers;
      if (second <= 12) {
        day = first;
        month = second;
      } else if (first <= 12) {
        month = first;
        day = second;
      } else {
        day = first;
      }
    } else if (numbers.length === 1 && numbers[0] <= 12) {
      month = numbers[0];
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
    checkPage: "Oldal ellen\u0151rz\xE9se",
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
    checkPage: "Check this page",
    copiedLog: "Log copied."
  };
  var DE = {
    title: "TreeViz Connector",
    signIn: "Melde dich bei TreeViz an und \xF6ffne den Baum in diesem Browser.",
    cached: "Die TreeViz-Daten sind seit {{time}} in diesem Browser.",
    notInTree: "Diese Person ist nicht im ge\xF6ffneten TreeViz-Baum.",
    inTree: "Diese Person ist im TreeViz-Baum: {{tree}}.",
    pickTree: "Mehr als ein TreeViz-Baum enth\xE4lt diese Person. W\xE4hl einen aus.",
    site: "Auf dieser Seite",
    onAncestry: "Auf Ancestry",
    onMyHeritage: "Auf MyHeritage",
    treeviz: "TreeViz",
    update: "Ausgew\xE4hlte Felder schreiben",
    updateSource: "{{source}} aktualisieren",
    updateTree: "In TreeViz aktualisieren",
    updatedTree: "In TreeViz geschrieben.",
    addedRelatives: "Zu TreeViz hinzugef\xFCgt: {{names}}",
    nothingToAdd: "TreeViz hat schon jeden Namen von dieser Seite.",
    treeClosed: "\xD6ffne diesen Baum in TreeViz, und versuch es noch einmal.",
    ambiguous: "Mehr als eine Person im Baum hat diesen Namen: {{names}}",
    relativesNotWritten: "Verwandte werden in diesem Layout nicht auf die Quellseite geschrieben.",
    warning: "Die \xC4nderung bleibt auf dieser Seite. TreeViz kann sie nicht r\xFCckg\xE4ngig machen. Nur die markierten Felder werden geschrieben.",
    layout: "TreeViz Connector kennt dieses Seitenlayout nicht und schreibt deshalb nicht.",
    noDiff: "TreeViz und diese Seite stimmen \xFCberein.",
    openSource: "Zur Pr\xFCfung \xF6ffnen",
    compare: "Pr\xFCf diese Person auf der Quellseite.",
    wrote: "Geschrieben.",
    failed: "Schreiben ist nicht gelungen.",
    openEdit: "Editor zum Vergleichen \xF6ffnen",
    whichPerson: "\xD6ffne das Profil der Person oder den Editor.",
    offline: "Zum Schreiben brauchst du eine Netzwerkverbindung.",
    name: "Name",
    sex: "Geschlecht",
    female: "weiblich",
    male: "m\xE4nnlich",
    birthDate: "Geburtsdatum",
    birthPlace: "Geburtsort",
    deathDate: "Sterbedatum",
    deathPlace: "Sterbeort",
    marriageDate: "Heiratsdatum",
    marriagePlace: "Heiratsort",
    parents: "Eltern",
    spouses: "Ehepartner",
    children: "Kinder",
    fact: "Ereignis",
    factsStale: "In diesen TreeViz-Daten sind noch keine weiteren Ereignisse. Lade den TreeViz-Tab neu, damit er den Baum noch einmal schickt.",
    factNotWritten: "Dieses Ereignis wird in diesem Layout nicht auf die Quellseite geschrieben.",
    relativesStale: "In diesen TreeViz-Daten sind noch keine Verwandten. Lade den TreeViz-Tab neu, damit er den Baum noch einmal schickt.",
    missingFact: "Das Ereignis ist auf dieser Seite nicht zu finden.",
    batchDone: "Die Ancestry-Aktualisierung ist fertig.",
    openApp: "TreeViz \xF6ffnen",
    hide: "Ausblenden",
    showPanel: "Panel anzeigen",
    panelShown: "Das Panel ist auf dieser Seite wieder sichtbar.",
    panelMissing: "Auf dieser Seite gibt es kein TreeViz-Connector-Panel.",
    persons: "{{count}} Personen",
    log: "Protokoll",
    copyLog: "Protokoll kopieren",
    checkPage: "Diese Seite pr\xFCfen",
    copiedLog: "Protokoll ist in der Zwischenablage."
  };
  var FR = {
    title: "TreeViz Connector",
    signIn: "Connecte-toi \xE0 TreeViz et ouvre l'arbre dans ce navigateur.",
    cached: "Les donn\xE9es TreeViz sont dans ce navigateur depuis {{time}}.",
    notInTree: "Cette personne n'est pas dans l'arbre TreeViz ouvert.",
    inTree: "Cette personne est dans l'arbre TreeViz : {{tree}}.",
    pickTree: "Plus d'un arbre TreeViz contient cette personne. Choisis-en un.",
    site: "Sur ce site",
    onAncestry: "Sur Ancestry",
    onMyHeritage: "Sur MyHeritage",
    treeviz: "TreeViz",
    update: "\xC9crire les champs coch\xE9s",
    updateSource: "Mettre \xE0 jour {{source}}",
    updateTree: "Mettre \xE0 jour dans TreeViz",
    updatedTree: "\xC9crit dans TreeViz.",
    addedRelatives: "Ajout\xE9 \xE0 TreeViz : {{names}}",
    nothingToAdd: "TreeViz a d\xE9j\xE0 tous les noms de cette page.",
    treeClosed: "Ouvre cet arbre dans TreeViz, puis r\xE9essaie.",
    ambiguous: "Plus d'une personne dans l'arbre porte ce nom : {{names}}",
    relativesNotWritten: "Les proches ne sont pas \xE9crits sur le site source avec cette mise en page.",
    warning: "La modification reste sur ce site. TreeViz ne peut pas l'annuler. Seuls les champs coch\xE9s sont \xE9crits.",
    layout: "TreeViz Connector ne conna\xEEt pas cette mise en page, donc il n'\xE9crit pas.",
    noDiff: "TreeViz et ce site correspondent.",
    openSource: "Ouvrir pour v\xE9rifier",
    compare: "V\xE9rifie cette personne sur le site source.",
    wrote: "\xC9crit.",
    failed: "\xC9criture impossible.",
    openEdit: "Ouvrir l'\xE9diteur pour comparer",
    whichPerson: "Ouvre le profil de la personne, ou l'\xE9diteur.",
    offline: "L'\xE9criture a besoin du r\xE9seau.",
    name: "Nom",
    sex: "Sexe",
    female: "femme",
    male: "homme",
    birthDate: "Date de naissance",
    birthPlace: "Lieu de naissance",
    deathDate: "Date de d\xE9c\xE8s",
    deathPlace: "Lieu de d\xE9c\xE8s",
    marriageDate: "Date de mariage",
    marriagePlace: "Lieu de mariage",
    parents: "Parents",
    spouses: "Conjoints",
    children: "Enfants",
    fact: "Fait",
    factsStale: "Ces donn\xE9es TreeViz n'ont pas encore les autres faits. Actualise l'onglet TreeViz pour qu'il renvoie l'arbre.",
    factNotWritten: "Ce fait n'est pas \xE9crit sur le site source avec cette mise en page.",
    relativesStale: "Ces donn\xE9es TreeViz n'ont pas encore les proches. Actualise l'onglet TreeViz pour qu'il renvoie l'arbre.",
    missingFact: "Le fait n'est pas sur cette page.",
    batchDone: "La mise \xE0 jour Ancestry est termin\xE9e.",
    openApp: "Ouvrir TreeViz",
    hide: "Masquer",
    showPanel: "Afficher le panneau",
    panelShown: "Le panneau est de nouveau visible sur cette page.",
    panelMissing: "Cette page n'a pas de panneau TreeViz Connector.",
    persons: "{{count}} personnes",
    log: "Journal",
    copyLog: "Copier le journal",
    checkPage: "V\xE9rifier cette page",
    copiedLog: "Journal copi\xE9."
  };
  var ES = {
    title: "TreeViz Connector",
    signIn: "Entra en TreeViz y abre el \xE1rbol en este navegador.",
    cached: "Los datos de TreeViz est\xE1n en este navegador desde {{time}}.",
    notInTree: "Esta persona no est\xE1 en el \xE1rbol de TreeViz abierto.",
    inTree: "Esta persona est\xE1 en el \xE1rbol de TreeViz: {{tree}}.",
    pickTree: "M\xE1s de un \xE1rbol de TreeViz contiene a esta persona. Elige uno.",
    site: "En este sitio",
    onAncestry: "En Ancestry",
    onMyHeritage: "En MyHeritage",
    treeviz: "TreeViz",
    update: "Escribir los campos marcados",
    updateSource: "Actualizar {{source}}",
    updateTree: "Actualizar en TreeViz",
    updatedTree: "Escrito en TreeViz.",
    addedRelatives: "A\xF1adido a TreeViz: {{names}}",
    nothingToAdd: "TreeViz ya tiene todos los nombres de esta p\xE1gina.",
    treeClosed: "Abre este \xE1rbol en TreeViz y vuelve a intentarlo.",
    ambiguous: "M\xE1s de una persona del \xE1rbol tiene este nombre: {{names}}",
    relativesNotWritten: "Los parientes no se escriben en el sitio de origen con este dise\xF1o.",
    warning: "El cambio se queda en este sitio. TreeViz no puede deshacerlo. Solo se escriben los campos marcados.",
    layout: "TreeViz Connector no conoce este dise\xF1o de p\xE1gina, as\xED que no escribe.",
    noDiff: "TreeViz y este sitio coinciden.",
    openSource: "Abrir para revisar",
    compare: "Revisa a esta persona en el sitio de origen.",
    wrote: "Escrito.",
    failed: "No se ha podido escribir.",
    openEdit: "Abrir el editor para comparar",
    whichPerson: "Abre el perfil de la persona o el editor.",
    offline: "Para escribir hace falta conexi\xF3n.",
    name: "Nombre",
    sex: "Sexo",
    female: "mujer",
    male: "hombre",
    birthDate: "Fecha de nacimiento",
    birthPlace: "Lugar de nacimiento",
    deathDate: "Fecha de defunci\xF3n",
    deathPlace: "Lugar de defunci\xF3n",
    marriageDate: "Fecha de matrimonio",
    marriagePlace: "Lugar de matrimonio",
    parents: "Padres",
    spouses: "C\xF3nyuges",
    children: "Hijos",
    fact: "Hecho",
    factsStale: "Estos datos de TreeViz a\xFAn no tienen los otros hechos. Recarga la pesta\xF1a de TreeViz para que vuelva a enviar el \xE1rbol.",
    factNotWritten: "Este hecho no se escribe en el sitio de origen con este dise\xF1o.",
    relativesStale: "Estos datos de TreeViz a\xFAn no tienen parientes. Recarga la pesta\xF1a de TreeViz para que vuelva a enviar el \xE1rbol.",
    missingFact: "El hecho no est\xE1 en esta p\xE1gina.",
    batchDone: "La actualizaci\xF3n de Ancestry ha terminado.",
    openApp: "Abrir TreeViz",
    hide: "Ocultar",
    showPanel: "Mostrar el panel",
    panelShown: "El panel vuelve a verse en esta p\xE1gina.",
    panelMissing: "Esta p\xE1gina no tiene panel de TreeViz Connector.",
    persons: "{{count}} personas",
    log: "Registro",
    copyLog: "Copiar registro",
    checkPage: "Comprobar esta p\xE1gina",
    copiedLog: "Registro copiado."
  };
  var RU = {
    title: "TreeViz Connector",
    signIn: "\u0412\u043E\u0439\u0434\u0438 \u0432 TreeViz \u0438 \u043E\u0442\u043A\u0440\u043E\u0439 \u0434\u0435\u0440\u0435\u0432\u043E \u0432 \u044D\u0442\u043E\u043C \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435.",
    cached: "\u0414\u0430\u043D\u043D\u044B\u0435 TreeViz \u0432 \u044D\u0442\u043E\u043C \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435 \u0441 {{time}}.",
    notInTree: "\u042D\u0442\u043E\u0433\u043E \u0447\u0435\u043B\u043E\u0432\u0435\u043A\u0430 \u043D\u0435\u0442 \u0432 \u043E\u0442\u043A\u0440\u044B\u0442\u043E\u043C \u0434\u0435\u0440\u0435\u0432\u0435 TreeViz.",
    inTree: "\u042D\u0442\u043E\u0442 \u0447\u0435\u043B\u043E\u0432\u0435\u043A \u0435\u0441\u0442\u044C \u0432 \u0434\u0435\u0440\u0435\u0432\u0435 TreeViz: {{tree}}.",
    pickTree: "\u042D\u0442\u043E\u0442 \u0447\u0435\u043B\u043E\u0432\u0435\u043A \u0435\u0441\u0442\u044C \u0432 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u0438\u0445 \u0434\u0435\u0440\u0435\u0432\u044C\u044F\u0445 TreeViz. \u0412\u044B\u0431\u0435\u0440\u0438 \u043E\u0434\u043D\u043E.",
    site: "\u041D\u0430 \u044D\u0442\u043E\u043C \u0441\u0430\u0439\u0442\u0435",
    onAncestry: "\u041D\u0430 Ancestry",
    onMyHeritage: "\u041D\u0430 MyHeritage",
    treeviz: "TreeViz",
    update: "\u0417\u0430\u043F\u0438\u0441\u0430\u0442\u044C \u043E\u0442\u043C\u0435\u0447\u0435\u043D\u043D\u044B\u0435 \u043F\u043E\u043B\u044F",
    updateSource: "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C {{source}}",
    updateTree: "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0432 TreeViz",
    updatedTree: "\u0417\u0430\u043F\u0438\u0441\u0430\u043D\u043E \u0432 TreeViz.",
    addedRelatives: "\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E \u0432 TreeViz: {{names}}",
    nothingToAdd: "\u0412 TreeViz \u0443\u0436\u0435 \u0435\u0441\u0442\u044C \u0432\u0441\u0435 \u0438\u043C\u0435\u043D\u0430 \u0441 \u044D\u0442\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B.",
    treeClosed: "\u041E\u0442\u043A\u0440\u043E\u0439 \u044D\u0442\u043E \u0434\u0435\u0440\u0435\u0432\u043E \u0432 TreeViz \u0438 \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u0441\u043D\u043E\u0432\u0430.",
    ambiguous: "\u0412 \u0434\u0435\u0440\u0435\u0432\u0435 \u0431\u043E\u043B\u044C\u0448\u0435 \u043E\u0434\u043D\u043E\u0433\u043E \u0447\u0435\u043B\u043E\u0432\u0435\u043A\u0430 \u0441 \u0442\u0430\u043A\u0438\u043C \u0438\u043C\u0435\u043D\u0435\u043C: {{names}}",
    relativesNotWritten: "\u0420\u043E\u0434\u0441\u0442\u0432\u0435\u043D\u043D\u0438\u043A\u043E\u0432 \u0432 \u044D\u0442\u043E\u0439 \u0440\u0430\u0441\u043A\u043B\u0430\u0434\u043A\u0435 \u043D\u0430 \u0441\u0430\u0439\u0442-\u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A \u043D\u0435 \u0437\u0430\u043F\u0438\u0441\u044B\u0432\u0430\u0435\u0442.",
    warning: "\u0418\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u043E\u0441\u0442\u0430\u043D\u0435\u0442\u0441\u044F \u043D\u0430 \u044D\u0442\u043E\u043C \u0441\u0430\u0439\u0442\u0435. TreeViz \u043D\u0435 \u0441\u043C\u043E\u0436\u0435\u0442 \u0435\u0433\u043E \u043E\u0442\u043C\u0435\u043D\u0438\u0442\u044C. \u0417\u0430\u043F\u0438\u0441\u044B\u0432\u0430\u044E\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u043E\u0442\u043C\u0435\u0447\u0435\u043D\u043D\u044B\u0435 \u043F\u043E\u043B\u044F.",
    layout: "TreeViz Connector \u043D\u0435 \u0437\u043D\u0430\u0435\u0442 \u044D\u0442\u0443 \u0440\u0430\u0441\u043A\u043B\u0430\u0434\u043A\u0443 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B \u0438 \u043F\u043E\u044D\u0442\u043E\u043C\u0443 \u043D\u0435 \u0437\u0430\u043F\u0438\u0441\u044B\u0432\u0430\u0435\u0442.",
    noDiff: "TreeViz \u0438 \u044D\u0442\u043E\u0442 \u0441\u0430\u0439\u0442 \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u044E\u0442.",
    openSource: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0434\u043B\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438",
    compare: "\u041F\u0440\u043E\u0432\u0435\u0440\u044C \u044D\u0442\u043E\u0433\u043E \u0447\u0435\u043B\u043E\u0432\u0435\u043A\u0430 \u043D\u0430 \u0441\u0430\u0439\u0442\u0435-\u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0435.",
    wrote: "\u0417\u0430\u043F\u0438\u0441\u0430\u043D\u043E.",
    failed: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u043F\u0438\u0441\u0430\u0442\u044C.",
    openEdit: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440 \u0434\u043B\u044F \u0441\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u044F",
    whichPerson: "\u041E\u0442\u043A\u0440\u043E\u0439 \u043F\u0440\u043E\u0444\u0438\u043B\u044C \u0447\u0435\u043B\u043E\u0432\u0435\u043A\u0430 \u0438\u043B\u0438 \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440.",
    offline: "\u0414\u043B\u044F \u0437\u0430\u043F\u0438\u0441\u0438 \u043D\u0443\u0436\u043D\u0430 \u0441\u0435\u0442\u044C.",
    name: "\u0418\u043C\u044F",
    sex: "\u041F\u043E\u043B",
    female: "\u0436\u0435\u043D\u0449\u0438\u043D\u0430",
    male: "\u043C\u0443\u0436\u0447\u0438\u043D\u0430",
    birthDate: "\u0414\u0430\u0442\u0430 \u0440\u043E\u0436\u0434\u0435\u043D\u0438\u044F",
    birthPlace: "\u041C\u0435\u0441\u0442\u043E \u0440\u043E\u0436\u0434\u0435\u043D\u0438\u044F",
    deathDate: "\u0414\u0430\u0442\u0430 \u0441\u043C\u0435\u0440\u0442\u0438",
    deathPlace: "\u041C\u0435\u0441\u0442\u043E \u0441\u043C\u0435\u0440\u0442\u0438",
    marriageDate: "\u0414\u0430\u0442\u0430 \u0431\u0440\u0430\u043A\u0430",
    marriagePlace: "\u041C\u0435\u0441\u0442\u043E \u0431\u0440\u0430\u043A\u0430",
    parents: "\u0420\u043E\u0434\u0438\u0442\u0435\u043B\u0438",
    spouses: "\u0421\u0443\u043F\u0440\u0443\u0433\u0438",
    children: "\u0414\u0435\u0442\u0438",
    fact: "\u0424\u0430\u043A\u0442",
    factsStale: "\u0412 \u044D\u0442\u0438\u0445 \u0434\u0430\u043D\u043D\u044B\u0445 TreeViz \u0435\u0449\u0451 \u043D\u0435\u0442 \u043E\u0441\u0442\u0430\u043B\u044C\u043D\u044B\u0445 \u0444\u0430\u043A\u0442\u043E\u0432. \u041E\u0431\u043D\u043E\u0432\u0438 \u0432\u043A\u043B\u0430\u0434\u043A\u0443 TreeViz, \u0447\u0442\u043E\u0431\u044B \u0434\u0435\u0440\u0435\u0432\u043E \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u043B\u043E\u0441\u044C \u0441\u043D\u043E\u0432\u0430.",
    factNotWritten: "\u042D\u0442\u043E\u0442 \u0444\u0430\u043A\u0442 \u0432 \u044D\u0442\u043E\u0439 \u0440\u0430\u0441\u043A\u043B\u0430\u0434\u043A\u0435 \u043D\u0430 \u0441\u0430\u0439\u0442-\u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A \u043D\u0435 \u0437\u0430\u043F\u0438\u0441\u044B\u0432\u0430\u0435\u0442\u0441\u044F.",
    relativesStale: "\u0412 \u044D\u0442\u0438\u0445 \u0434\u0430\u043D\u043D\u044B\u0445 TreeViz \u0435\u0449\u0451 \u043D\u0435\u0442 \u0440\u043E\u0434\u0441\u0442\u0432\u0435\u043D\u043D\u0438\u043A\u043E\u0432. \u041E\u0431\u043D\u043E\u0432\u0438 \u0432\u043A\u043B\u0430\u0434\u043A\u0443 TreeViz, \u0447\u0442\u043E\u0431\u044B \u0434\u0435\u0440\u0435\u0432\u043E \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u043B\u043E\u0441\u044C \u0441\u043D\u043E\u0432\u0430.",
    missingFact: "\u042D\u0442\u043E\u0433\u043E \u0444\u0430\u043A\u0442\u0430 \u043D\u0435\u0442 \u043D\u0430 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435.",
    batchDone: "\u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 Ancestry \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u043E.",
    openApp: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C TreeViz",
    hide: "\u0421\u043A\u0440\u044B\u0442\u044C",
    showPanel: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u043F\u0430\u043D\u0435\u043B\u044C",
    panelShown: "\u041F\u0430\u043D\u0435\u043B\u044C \u0441\u043D\u043E\u0432\u0430 \u0432\u0438\u0434\u043D\u0430 \u043D\u0430 \u044D\u0442\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435.",
    panelMissing: "\u041D\u0430 \u044D\u0442\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435 \u043D\u0435\u0442 \u043F\u0430\u043D\u0435\u043B\u0438 TreeViz Connector.",
    persons: "{{count}} \u0447\u0435\u043B.",
    log: "\u0416\u0443\u0440\u043D\u0430\u043B",
    copyLog: "\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0436\u0443\u0440\u043D\u0430\u043B",
    checkPage: "\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u044D\u0442\u0443 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443",
    copiedLog: "\u0416\u0443\u0440\u043D\u0430\u043B \u0441\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D."
  };
  var JA = {
    title: "TreeViz Connector",
    signIn: "\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u3067 TreeViz \u306B\u30B5\u30A4\u30F3\u30A4\u30F3\u3057\u3066\u3001\u5BB6\u7CFB\u56F3\u3092\u958B\u3044\u3066\u3002",
    cached: "TreeViz \u306E\u30C7\u30FC\u30BF\u306F {{time}} \u304B\u3089\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u306B\u3042\u308B\u3002",
    notInTree: "\u3053\u306E\u4EBA\u306F\u958B\u3044\u3066\u3044\u308B TreeViz \u306E\u5BB6\u7CFB\u56F3\u306B\u3044\u306A\u3044\u3002",
    inTree: "\u3053\u306E\u4EBA\u306F TreeViz \u306E\u5BB6\u7CFB\u56F3\u306B\u3044\u308B: {{tree}}\u3002",
    pickTree: "\u3053\u306E\u4EBA\u304C\u8907\u6570\u306E TreeViz \u5BB6\u7CFB\u56F3\u306B\u3044\u308B\u3002\u4E00\u3064\u9078\u3093\u3067\u3002",
    site: "\u3053\u306E\u30B5\u30A4\u30C8",
    onAncestry: "Ancestry",
    onMyHeritage: "MyHeritage",
    treeviz: "TreeViz",
    update: "\u9078\u3093\u3060\u9805\u76EE\u3092\u66F8\u304D\u8FBC\u3080",
    updateSource: "{{source}} \u3092\u66F4\u65B0",
    updateTree: "TreeViz \u3092\u66F4\u65B0",
    updatedTree: "TreeViz \u306B\u66F8\u304D\u8FBC\u3093\u3060\u3002",
    addedRelatives: "TreeViz \u306B\u8FFD\u52A0: {{names}}",
    nothingToAdd: "\u3053\u306E\u30DA\u30FC\u30B8\u306E\u540D\u524D\u306F\u3059\u3067\u306B TreeViz \u306B\u3042\u308B\u3002",
    treeClosed: "\u3053\u306E\u5BB6\u7CFB\u56F3\u3092 TreeViz \u3067\u958B\u3044\u3066\u3001\u3082\u3046\u4E00\u5EA6\u8A66\u3057\u3066\u3002",
    ambiguous: "\u540C\u3058\u540D\u524D\u306E\u4EBA\u304C\u8907\u6570\u3044\u308B: {{names}}",
    relativesNotWritten: "\u3053\u306E\u30EC\u30A4\u30A2\u30A6\u30C8\u3067\u306F\u89AA\u65CF\u3092\u5143\u306E\u30B5\u30A4\u30C8\u306B\u66F8\u304D\u8FBC\u307E\u306A\u3044\u3002",
    warning: "\u5909\u66F4\u306F\u3053\u306E\u30B5\u30A4\u30C8\u306B\u6B8B\u308B\u3002TreeViz \u306F\u53D6\u308A\u6D88\u305B\u306A\u3044\u3002\u30C1\u30A7\u30C3\u30AF\u3057\u305F\u9805\u76EE\u3060\u3051\u66F8\u304D\u8FBC\u3080\u3002",
    layout: "TreeViz Connector \u306F\u3053\u306E\u30DA\u30FC\u30B8\u306E\u30EC\u30A4\u30A2\u30A6\u30C8\u3092\u77E5\u3089\u306A\u3044\u306E\u3067\u3001\u66F8\u304D\u8FBC\u307E\u306A\u3044\u3002",
    noDiff: "TreeViz \u3068\u3053\u306E\u30B5\u30A4\u30C8\u306F\u4E00\u81F4\u3057\u3066\u3044\u308B\u3002",
    openSource: "\u78BA\u8A8D\u306E\u305F\u3081\u306B\u958B\u304F",
    compare: "\u5143\u306E\u30B5\u30A4\u30C8\u3067\u3053\u306E\u4EBA\u3092\u78BA\u8A8D\u3057\u3066\u3002",
    wrote: "\u66F8\u304D\u8FBC\u3093\u3060\u3002",
    failed: "\u66F8\u304D\u8FBC\u3081\u306A\u304B\u3063\u305F\u3002",
    openEdit: "\u6BD4\u8F03\u3059\u308B\u305F\u3081\u306B\u7DE8\u96C6\u753B\u9762\u3092\u958B\u304F",
    whichPerson: "\u4EBA\u7269\u306E\u30D7\u30ED\u30D5\u30A3\u30FC\u30EB\u304B\u7DE8\u96C6\u753B\u9762\u3092\u958B\u3044\u3066\u3002",
    offline: "\u66F8\u304D\u8FBC\u307F\u306B\u306F\u30CD\u30C3\u30C8\u63A5\u7D9A\u304C\u5FC5\u8981\u3002",
    name: "\u540D\u524D",
    sex: "\u6027\u5225",
    female: "\u5973\u6027",
    male: "\u7537\u6027",
    birthDate: "\u751F\u5E74\u6708\u65E5",
    birthPlace: "\u51FA\u751F\u5730",
    deathDate: "\u6B7B\u4EA1\u65E5",
    deathPlace: "\u6B7B\u4EA1\u5730",
    marriageDate: "\u7D50\u5A5A\u65E5",
    marriagePlace: "\u7D50\u5A5A\u5730",
    parents: "\u89AA",
    spouses: "\u914D\u5076\u8005",
    children: "\u5B50\u3069\u3082",
    fact: "\u4E8B\u5B9F",
    factsStale: "\u3053\u306E TreeViz \u30C7\u30FC\u30BF\u306B\u306F\u307E\u3060\u4ED6\u306E\u4E8B\u5B9F\u304C\u306A\u3044\u3002TreeViz \u306E\u30BF\u30D6\u3092\u66F4\u65B0\u3057\u3066\u3001\u5BB6\u7CFB\u56F3\u3092\u9001\u308A\u76F4\u3057\u3066\u3002",
    factNotWritten: "\u3053\u306E\u4E8B\u5B9F\u306F\u3053\u306E\u30EC\u30A4\u30A2\u30A6\u30C8\u3067\u306F\u5143\u306E\u30B5\u30A4\u30C8\u306B\u66F8\u304D\u8FBC\u307E\u306A\u3044\u3002",
    relativesStale: "\u3053\u306E TreeViz \u30C7\u30FC\u30BF\u306B\u306F\u307E\u3060\u89AA\u65CF\u304C\u3044\u306A\u3044\u3002TreeViz \u306E\u30BF\u30D6\u3092\u66F4\u65B0\u3057\u3066\u3001\u5BB6\u7CFB\u56F3\u3092\u9001\u308A\u76F4\u3057\u3066\u3002",
    missingFact: "\u3053\u306E\u4E8B\u5B9F\u306F\u3053\u306E\u30DA\u30FC\u30B8\u306B\u306A\u3044\u3002",
    batchDone: "Ancestry \u306E\u66F4\u65B0\u304C\u7D42\u308F\u3063\u305F\u3002",
    openApp: "TreeViz \u3092\u958B\u304F",
    hide: "\u96A0\u3059",
    showPanel: "\u30D1\u30CD\u30EB\u3092\u8868\u793A",
    panelShown: "\u3053\u306E\u30DA\u30FC\u30B8\u3067\u30D1\u30CD\u30EB\u304C\u518D\u3073\u898B\u3048\u308B\u3002",
    panelMissing: "\u3053\u306E\u30DA\u30FC\u30B8\u306B\u306F TreeViz Connector \u306E\u30D1\u30CD\u30EB\u304C\u306A\u3044\u3002",
    persons: "{{count}} \u4EBA",
    log: "\u30ED\u30B0",
    copyLog: "\u30ED\u30B0\u3092\u30B3\u30D4\u30FC",
    checkPage: "\u3053\u306E\u30DA\u30FC\u30B8\u3092\u78BA\u8A8D",
    copiedLog: "\u30ED\u30B0\u3092\u30B3\u30D4\u30FC\u3057\u305F\u3002"
  };
  var ZH = {
    title: "TreeViz Connector",
    signIn: "\u5728\u8FD9\u4E2A\u6D4F\u89C8\u5668\u91CC\u767B\u5F55 TreeViz\uFF0C\u5E76\u6253\u5F00\u5BB6\u8C31\u3002",
    cached: "TreeViz \u6570\u636E\u4ECE {{time}} \u8D77\u5C31\u5728\u8FD9\u4E2A\u6D4F\u89C8\u5668\u91CC\u3002",
    notInTree: "\u8FD9\u4E2A\u4EBA\u4E0D\u5728\u5F53\u524D\u6253\u5F00\u7684 TreeViz \u5BB6\u8C31\u91CC\u3002",
    inTree: "\u8FD9\u4E2A\u4EBA\u5728 TreeViz \u5BB6\u8C31\u91CC\uFF1A{{tree}}\u3002",
    pickTree: "\u4E0D\u6B62\u4E00\u4E2A TreeViz \u5BB6\u8C31\u5305\u542B\u8FD9\u4E2A\u4EBA\u3002\u9009\u4E00\u4E2A\u3002",
    site: "\u5728\u8FD9\u4E2A\u7F51\u7AD9\u4E0A",
    onAncestry: "\u5728 Ancestry \u4E0A",
    onMyHeritage: "\u5728 MyHeritage \u4E0A",
    treeviz: "TreeViz",
    update: "\u5199\u5165\u9009\u4E2D\u7684\u5B57\u6BB5",
    updateSource: "\u66F4\u65B0 {{source}}",
    updateTree: "\u5728 TreeViz \u4E2D\u66F4\u65B0",
    updatedTree: "\u5DF2\u5199\u5165 TreeViz\u3002",
    addedRelatives: "\u5DF2\u52A0\u5165 TreeViz\uFF1A{{names}}",
    nothingToAdd: "TreeViz \u91CC\u5DF2\u7ECF\u6709\u8FD9\u4E00\u9875\u4E0A\u7684\u6240\u6709\u59D3\u540D\u3002",
    treeClosed: "\u5728 TreeViz \u91CC\u6253\u5F00\u8FD9\u4E2A\u5BB6\u8C31\uFF0C\u7136\u540E\u518D\u8BD5\u4E00\u6B21\u3002",
    ambiguous: "\u5BB6\u8C31\u91CC\u6709\u4E0D\u6B62\u4E00\u4E2A\u540C\u540D\u7684\u4EBA\uFF1A{{names}}",
    relativesNotWritten: "\u8FD9\u79CD\u7248\u5F0F\u4E0D\u4F1A\u628A\u4EB2\u5C5E\u5199\u56DE\u6E90\u7F51\u7AD9\u3002",
    warning: "\u4FEE\u6539\u4F1A\u7559\u5728\u8FD9\u4E2A\u7F51\u7AD9\u4E0A\u3002TreeViz \u4E0D\u80FD\u64A4\u9500\u3002\u53EA\u4F1A\u5199\u5165\u52FE\u9009\u7684\u5B57\u6BB5\u3002",
    layout: "TreeViz Connector \u4E0D\u8BA4\u8BC6\u8FD9\u4E2A\u9875\u9762\u7248\u5F0F\uFF0C\u6240\u4EE5\u4E0D\u4F1A\u5199\u5165\u3002",
    noDiff: "TreeViz \u548C\u8FD9\u4E2A\u7F51\u7AD9\u4E00\u81F4\u3002",
    openSource: "\u6253\u5F00\u4EE5\u6838\u5BF9",
    compare: "\u5728\u6E90\u7F51\u7AD9\u4E0A\u6838\u5BF9\u8FD9\u4E2A\u4EBA\u3002",
    wrote: "\u5DF2\u5199\u5165\u3002",
    failed: "\u6CA1\u80FD\u5199\u5165\u3002",
    openEdit: "\u6253\u5F00\u7F16\u8F91\u9875\u4EE5\u4FBF\u6BD4\u8F83",
    whichPerson: "\u6253\u5F00\u8FD9\u4E2A\u4EBA\u7684\u8D44\u6599\u9875\u6216\u7F16\u8F91\u9875\u3002",
    offline: "\u5199\u5165\u9700\u8981\u7F51\u7EDC\u3002",
    name: "\u59D3\u540D",
    sex: "\u6027\u522B",
    female: "\u5973",
    male: "\u7537",
    birthDate: "\u51FA\u751F\u65E5\u671F",
    birthPlace: "\u51FA\u751F\u5730",
    deathDate: "\u6B7B\u4EA1\u65E5\u671F",
    deathPlace: "\u6B7B\u4EA1\u5730",
    marriageDate: "\u7ED3\u5A5A\u65E5\u671F",
    marriagePlace: "\u7ED3\u5A5A\u5730",
    parents: "\u7236\u6BCD",
    spouses: "\u914D\u5076",
    children: "\u5B50\u5973",
    fact: "\u4E8B\u5B9E",
    factsStale: "\u8FD9\u4EFD TreeViz \u6570\u636E\u91CC\u8FD8\u6CA1\u6709\u5176\u4ED6\u4E8B\u5B9E\u3002\u5237\u65B0 TreeViz \u6807\u7B7E\u9875\uFF0C\u8BA9\u5B83\u91CD\u65B0\u53D1\u9001\u5BB6\u8C31\u3002",
    factNotWritten: "\u8FD9\u79CD\u7248\u5F0F\u4E0D\u4F1A\u628A\u8FD9\u6761\u4E8B\u5B9E\u5199\u56DE\u6E90\u7F51\u7AD9\u3002",
    relativesStale: "\u8FD9\u4EFD TreeViz \u6570\u636E\u91CC\u8FD8\u6CA1\u6709\u4EB2\u5C5E\u3002\u5237\u65B0 TreeViz \u6807\u7B7E\u9875\uFF0C\u8BA9\u5B83\u91CD\u65B0\u53D1\u9001\u5BB6\u8C31\u3002",
    missingFact: "\u8FD9\u4E00\u9875\u4E0A\u6CA1\u6709\u8FD9\u6761\u4E8B\u5B9E\u3002",
    batchDone: "Ancestry \u66F4\u65B0\u5DF2\u5B8C\u6210\u3002",
    openApp: "\u6253\u5F00 TreeViz",
    hide: "\u9690\u85CF",
    showPanel: "\u663E\u793A\u9762\u677F",
    panelShown: "\u9762\u677F\u5728\u8FD9\u4E00\u9875\u4E0A\u518D\u6B21\u53EF\u89C1\u3002",
    panelMissing: "\u8FD9\u4E00\u9875\u6CA1\u6709 TreeViz Connector \u9762\u677F\u3002",
    persons: "{{count}} \u4EBA",
    log: "\u65E5\u5FD7",
    copyLog: "\u590D\u5236\u65E5\u5FD7",
    checkPage: "\u68C0\u67E5\u6B64\u9875\u9762",
    copiedLog: "\u65E5\u5FD7\u5DF2\u590D\u5236\u3002"
  };
  var LANGUAGES = ["hu", "en", "de", "fr", "es", "ru", "ja", "zh"];
  var TABLES = {
    hu: HU,
    en: EN,
    de: DE,
    fr: FR,
    es: ES,
    ru: RU,
    ja: JA,
    zh: ZH
  };
  var LANGUAGE_KEY = "treevizConnectorLanguage";
  var browserLanguage = () => {
    const code = navigator.language.toLowerCase().slice(0, 2);
    return LANGUAGES.includes(code) ? code : "en";
  };
  var language = browserLanguage();
  var listeners2 = /* @__PURE__ */ new Set();
  var applyLanguage = (next) => {
    if (next === language) {
      return;
    }
    language = next;
    for (const listener of listeners2) {
      listener();
    }
  };
  var onLanguage = (listener) => {
    listeners2.add(listener);
    return () => listeners2.delete(listener);
  };
  var isConnectorLanguage = (value) => typeof value === "string" && LANGUAGES.includes(value);
  var languageReady = new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      resolve();
      return;
    }
    chrome.storage.local.get(LANGUAGE_KEY, (items) => {
      const stored = items[LANGUAGE_KEY];
      if (isConnectorLanguage(stored)) {
        applyLanguage(stored);
      }
      resolve();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes[LANGUAGE_KEY]) {
        return;
      }
      const next = changes[LANGUAGE_KEY].newValue;
      if (isConnectorLanguage(next)) {
        applyLanguage(next);
      }
    });
  });
  var t = (key, vars) => {
    let text = TABLES[language][key];
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
  var hintLine = (line) => /(^| )hints?( |$)/.test(foldName(line));
  var chromeLine = (line) => {
    const key = foldName(line);
    const squashed = key.replace(/\s+/g, "");
    return SKIP_TITLES.has(key) || SKIP_TITLES.has(squashed) || hintLine(line);
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
      if (!text || text.length > 140 || !text.includes("\n") || hintLine(text)) {
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
      if (!title || title.length > 40 || chromeLine(title) || hintLine(title) || LIFE_HEADER.test(foldName(title))) {
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
		button.open {
			height: auto;
			min-height: 32px;
			padding: 8px 12px;
			white-space: normal;
			text-align: center;
		}
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
    if (model.onOpenEditor) {
      const open = document.createElement("button");
      open.type = "button";
      open.className = "open";
      open.textContent = t("openEdit");
      open.disabled = Boolean(model.busy);
      open.addEventListener("click", () => model.onOpenEditor?.());
      card.append(open);
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

  // extensions/treeviz-connector/src/probe.ts
  var htmlSkeleton = (root, limit = 7e3) => {
    const lines2 = [];
    const walk = (node, depth) => {
      if (depth > 7 || lines2.join("\n").length > limit) {
        return;
      }
      const id = node.id ? `#${node.id}` : "";
      const name = node.getAttribute("name");
      const type = node.getAttribute("type");
      const className = typeof node.className === "string" ? node.className.trim().split(/\s+/).filter(Boolean).slice(0, 3) : [];
      const cls = className.length ? `.${className.join(".")}` : "";
      lines2.push(
        `${"  ".repeat(depth)}<${node.tagName.toLowerCase()}${id}${name ? `[name=${name}]` : ""}${type ? `[type=${type}]` : ""}${cls}>`
      );
      for (const child of Array.from(node.children).slice(0, 30)) {
        walk(child, depth + 1);
      }
    };
    if (root instanceof Element) {
      walk(root, 0);
    }
    return lines2.join("\n").slice(0, limit);
  };
  var formatProbe = (title, lines2, html) => {
    const body = lines2.map(
      (line) => `${line.ok ? "ok" : "MISSING"} ${line.name}${line.detail ? ` ${line.detail}` : ""}`
    ).join("\n");
    return html ? `${title}
${body}
--- html ---
${html}` : `${title}
${body}`;
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
  var LIVING_STATUS = /* @__PURE__ */ new Set([
    "living",
    "alive",
    "el",
    "lebt",
    "lebend",
    "vivant",
    "vivo",
    "viva",
    "vivante"
  ]);
  var isLivingStatus = (value) => LIVING_STATUS.has(foldName(value));
  var splitFactLine = (value) => {
    if (!value || isLivingStatus(value)) {
      return {};
    }
    if (/[•·]/.test(value)) {
      const [date, ...rest] = value.split(/\s*[•·]\s*/);
      if (isLivingStatus(date)) {
        return { place: rest.join(", ").trim() || void 0 };
      }
      return { date: date.trim(), place: rest.join(", ").trim() || void 0 };
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
  var LIFE_LABELS = {
    birth: ["birth", "szuletes", "geburt", "naissance", "nacimiento", "nascita"],
    death: ["death", "halal", "tod", "deces", "defuncion", "morte"],
    marriage: ["marriage", "hazassag", "heirat", "mariage", "matrimonio", "casamiento"]
  };
  var lifeKind = (label2) => {
    const key = foldName(label2);
    for (const [kind, names] of Object.entries(LIFE_LABELS)) {
      if (names.includes(key)) {
        return kind;
      }
    }
    return void 0;
  };
  var looksLikeLifeValue = (value) => /\d{4}/.test(value) || /[•·]/.test(value) || isLivingStatus(value) || value.includes(",");
  var readVisibleLife = () => {
    const found = {};
    const keep = (kind, raw) => {
      if (found[kind]?.date) {
        return;
      }
      const lines2 = raw.split("\n").map((line) => line.trim()).filter((line) => line && !/^(explore|search|add|edit|filter|add fact)$/i.test(line));
      const parsed = splitFactLine(lines2.join(" "));
      if (!parsed.date && !parsed.place) {
        return;
      }
      if (!found[kind] || parsed.date) {
        found[kind] = parsed;
      }
    };
    document.querySelectorAll("div, span, p, li, h2, h3, dt, dd").forEach((node) => {
      const el = node;
      if (el.closest("#treeviz-connector-root")) {
        return;
      }
      const text = el.innerText?.trim() ?? "";
      if (!text || text.length > 180) {
        return;
      }
      if (Array.from(el.children).some((child) => child.innerText?.trim() === text)) {
        return;
      }
      const childHasLifeLabel = Array.from(el.querySelectorAll("div, span, p, li")).some((child) => {
        const childText = child.innerText?.trim() ?? "";
        const first = childText.replace(/\s+/g, " ").split(" ")[0] ?? "";
        return Boolean(childText) && childText.length < text.length && lifeKind(first);
      });
      if (childHasLifeLabel) {
        return;
      }
      const flat = text.replace(/\s+/g, " ").trim();
      const labeled = flat.match(/^(\p{L}+)\s+(.+)$/u);
      if (labeled) {
        const kind2 = lifeKind(labeled[1]);
        if (kind2 && looksLikeLifeValue(labeled[2])) {
          keep(kind2, labeled[2]);
          return;
        }
      }
      const kind = lifeKind(flat);
      const next = el.nextElementSibling;
      if (!kind || !(next instanceof HTMLElement)) {
        return;
      }
      const value = next.innerText?.trim() ?? "";
      if (!value || value.length > 180 || !looksLikeLifeValue(value)) {
        return;
      }
      keep(kind, value);
    });
    return {
      birth: found.birth ?? {},
      death: found.death ?? {},
      marriage: found.marriage ?? {}
    };
  };
  var profileHeading = () => {
    const heading = document.querySelector("h1");
    return heading instanceof HTMLElement ? heading : void 0;
  };
  var headerName = () => {
    const text = profileHeading()?.textContent?.replace(/\s+/g, " ").trim();
    if (!text || text.length > 80) {
      return void 0;
    }
    return text;
  };
  var headerBanner = () => {
    const heading = profileHeading();
    let node = heading?.parentElement ?? void 0;
    for (let depth = 0; node && depth < 6; depth += 1) {
      if (node.querySelector("img") || getComputedStyle(node).backgroundImage !== "none") {
        return node;
      }
      node = node.parentElement ?? void 0;
    }
    return heading?.parentElement ?? void 0;
  };
  var headerSex = () => {
    const banner = headerBanner();
    if (!banner) {
      return void 0;
    }
    const chunks = [];
    banner.querySelectorAll("*").forEach((node) => {
      for (const name of ["aria-label", "title", "alt", "src", "class"]) {
        const value = node.getAttribute(name);
        if (value) {
          chunks.push(value);
        }
      }
      if (node instanceof HTMLElement) {
        const image = getComputedStyle(node).backgroundImage;
        if (image && image !== "none") {
          chunks.push(image);
        }
      }
    });
    const blob = chunks.join(" ").toLocaleLowerCase();
    const female = /\b(female|woman|weiblich|mujer|femme|nő|no)\b/.test(blob) || /gender[_-]?f\b|silhouette[_-]f|iconfemale|_f_|\/f\//.test(blob);
    const male = /\b(male|man|männlich|hombre|homme|férfi|ferfi)\b/.test(blob) || /gender[_-]?m\b|silhouette[_-]m|iconmale|_m_|\/m\//.test(blob);
    if (female && !male) {
      return "F";
    }
    if (male && !female) {
      return "M";
    }
    return void 0;
  };
  var siteFacts = () => {
    const layoutKnown = ancestryLayoutKnown(document);
    const cards = readAncestryCards(document);
    const name = cardText(cards, ["name", "n\xE9v", "nev", "nom", "nombre"]);
    const sex = cardText(cards, ["gender", "sex", "nem", "geschlecht", "sexe", "sexo"]);
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
    const life = readVisibleLife();
    return {
      layoutKnown,
      name: name?.subtitle || headerName() || valueUnderLabel(["name", "n\xE9v", "nev", "nom", "nombre"]),
      sex: sex?.subtitle || headerSex() || valueUnderLabel(["gender", "sex", "nem", "geschlecht", "sexe", "sexo"]),
      birthDate: birth?.date || life.birth.date || looseBirth.date,
      birthPlace: birth?.place || life.birth.place || looseBirth.place,
      deathDate: death?.date || life.death.date || looseDeath.date,
      deathPlace: death?.place || life.death.place || looseDeath.place,
      marriageDate: marriage?.date || life.marriage.date || looseMarriage.date,
      marriagePlace: marriage?.place || life.marriage.place || looseMarriage.place
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
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const body = message;
    if (body?.type === "connector:run-batch") {
      void runBatch();
      return;
    }
    if (body?.type === "connector:probe") {
      const report = probeAncestry();
      connectorLog("probe", report);
      sendResponse({ ok: true, report });
    }
  });
  var probeAncestry = () => {
    const facts = document.querySelector("#researchListFacts");
    const lines2 = [
      { ok: Boolean(facts), name: "#researchListFacts" }
    ];
    if (facts) {
      const cards = facts.querySelectorAll("li.researchListItem");
      lines2.push({
        ok: cards.length > 0,
        name: "li.researchListItem",
        detail: String(cards.length)
      });
      for (const selector of [
        ".userCardTitle",
        ".factItemDate",
        ".factItemLocation",
        ".userCardSubTitle",
        ".textWrap"
      ]) {
        lines2.push({
          ok: facts.querySelector(selector) != null,
          name: selector
        });
      }
      const titles = Array.from(facts.querySelectorAll(".userCardTitle")).map((node) => node.textContent?.trim() || "").filter(Boolean).slice(0, 40);
      lines2.push({ ok: titles.length > 0, name: "titles", detail: titles.join(", ") });
    }
    const failed = lines2.some((line) => !line.ok);
    return formatProbe(
      `ancestry ${location.pathname}`,
      lines2,
      failed ? htmlSkeleton(facts || document.body) : void 0
    );
  };
  void languageReady.then(() => {
    tick();
    window.setInterval(tick, 1e3);
    onLanguage(() => {
      href = "";
      tick();
    });
  });
})();
