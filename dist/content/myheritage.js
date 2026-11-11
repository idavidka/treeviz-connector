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
    "e mail": "email",
    address: "residence",
    employment: "occupation",
    "military service": "military",
    "web link": "web address",
    "web links": "web address"
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
  var NAME_SUFFIX = /* @__PURE__ */ new Set(["dr", "jr", "sr", "ii", "iii", "iv", "ifj", "phd", "md", "prof"]);
  var samePersonName = (left, right) => {
    const strip = (value) => foldName(value).split(" ").filter((word) => word && !NAME_SUFFIX.has(word)).join(" ");
    return sameName(strip(left), strip(right));
  };
  var dateChunk = () => /\b(?:bef|before|abt|about|aft|after|cir|circa|est|cal)\.?\s+\d{4}\b|\b\d{1,2}\s+[a-z]{3,}\.?\s+\d{4}\b|\b[a-z]{3,}\.?\s+\d{4}\b|\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b|\b\d{4}\b/gi;
  var factDates = (value) => {
    const found = collapse(value).match(dateChunk()) ?? [];
    return [...new Set(found.map((part) => part.trim()))];
  };
  var withoutDates = (value) => collapse(value).replace(dateChunk(), " ").replace(/https?:\/\/\S+/gi, " ");
  var factUrls = (value) => {
    const found = collapse(value).match(/https?:\/\/[^\s]+/gi) ?? [];
    return found.map((href2) => {
      const trimmed = href2.replace(/[),.;]+$/g, "");
      try {
        const url = new URL(trimmed);
        const decode = (part) => {
          try {
            return decodeURIComponent(part);
          } catch {
            return part;
          }
        };
        const query = decode(url.search.replace(/^\?/, ""));
        return `${url.origin}${decode(url.pathname)}${query ? `?${query}` : ""}`.replace(/\/$/, "");
      } catch {
        return trimmed.replace(/\/$/, "");
      }
    });
  };
  var sameFactValue = (left, right) => {
    if (sameName(left, right)) {
      return true;
    }
    const urlsLeft = factUrls(left);
    const urlsRight = factUrls(right);
    if (urlsLeft.length && urlsRight.length) {
      if (!urlsLeft.some((href2) => urlsRight.includes(href2))) {
        return false;
      }
      const leftover = (value) => foldName(collapse(value).replace(/https?:\/\/\S+/gi, " "));
      const leftName = leftover(left);
      const rightName = leftover(right);
      if (!leftName || !rightName) {
        return true;
      }
      return leftName === rightName || leftName.includes(rightName) || rightName.includes(leftName);
    }
    const datesLeft = factDates(left);
    const datesRight = factDates(right);
    if (datesLeft.length && datesRight.length && !datesLeft.some((date) => datesRight.some((other) => sameDate(date, other)))) {
      return false;
    }
    const textLeft = foldName(withoutDates(left));
    const textRight = foldName(withoutDates(right));
    if (!textLeft || !textRight) {
      return Boolean(datesLeft.length && datesRight.length);
    }
    return textLeft === textRight || textLeft.includes(textRight) || textRight.includes(textLeft);
  };
  var sameFactText = (left, right) => {
    const textLeft = foldName(withoutDates(left));
    const textRight = foldName(withoutDates(right));
    if (!textLeft || !textRight) {
      return false;
    }
    return textLeft === textRight || textLeft.includes(textRight) || textRight.includes(textLeft);
  };
  var diffFactValues = (siteFacts, treeFacts, treeWritable) => {
    const titles = /* @__PURE__ */ new Map();
    for (const fact of [...siteFacts, ...treeFacts]) {
      const key = factTitleKey(fact.title);
      if (key && !titles.has(key)) {
        titles.set(key, fact.title);
      }
    }
    const diffs = [];
    for (const [key, title] of titles) {
      const siteValues = siteFacts.filter((fact) => factTitleKey(fact.title) === key).map((fact) => fact.value);
      const treeValues = treeFacts.filter((fact) => factTitleKey(fact.title) === key).map((fact) => fact.value);
      const unmatchedSite = siteValues.filter(
        (value) => !treeValues.some((treeValue) => sameFactValue(treeValue, value))
      );
      const unmatchedTree = treeValues.filter(
        (value) => !siteValues.some((siteValue) => sameFactValue(siteValue, value))
      );
      const used = /* @__PURE__ */ new Set();
      for (const site of unmatchedSite) {
        const index = unmatchedTree.findIndex(
          (treeValue, treeIndex) => !used.has(treeIndex) && sameFactText(site, treeValue)
        );
        if (index >= 0) {
          used.add(index);
          diffs.push({
            key: "fact",
            label: title,
            site,
            treeviz: unmatchedTree[index],
            writable: treeWritable
          });
          continue;
        }
        diffs.push({ key: "fact", label: title, site, writable: false });
      }
      unmatchedTree.forEach((treeValue, index) => {
        if (used.has(index)) {
          return;
        }
        diffs.push({
          key: "fact",
          label: title,
          treeviz: treeValue,
          writable: treeWritable
        });
      });
    }
    return diffs;
  };
  var diffNameList = (key, siteNames, treeNames) => {
    const unmatchedSite = siteNames.filter(
      (siteName) => !treeNames.some((treeName) => samePersonName(siteName, treeName))
    );
    const unmatchedTree = treeNames.filter(
      (treeName) => !siteNames.some((siteName) => samePersonName(siteName, treeName))
    );
    if (!unmatchedSite.length && !unmatchedTree.length) {
      return void 0;
    }
    return {
      key,
      site: siteNames.join(", ") || void 0,
      treeviz: treeNames.join(", ") || void 0,
      writable: false
    };
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
    noParentSlot: "Mindk\xE9t sz\xFCl\u0151 helye foglalt az Ancestryn.",
    siteNamesPresent: "Az oldalon m\xE1r szerepel minden n\xE9v.",
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
    noParentSlot: "Both parent slots are already filled on Ancestry.",
    siteNamesPresent: "Every name is already on the page.",
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
    noParentSlot: "Beide Elternpl\xE4tze sind bei Ancestry schon belegt.",
    siteNamesPresent: "Jeder Name steht schon auf der Seite.",
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
    noParentSlot: "Les deux places de parents sont d\xE9j\xE0 prises sur Ancestry.",
    siteNamesPresent: "Tous les noms sont d\xE9j\xE0 sur la page.",
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
    noParentSlot: "Los dos lugares de padres ya est\xE1n ocupados en Ancestry.",
    siteNamesPresent: "Todos los nombres ya est\xE1n en la p\xE1gina.",
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
    noParentSlot: "\u041E\u0431\u0430 \u043C\u0435\u0441\u0442\u0430 \u0440\u043E\u0434\u0438\u0442\u0435\u043B\u0435\u0439 \u043D\u0430 Ancestry \u0443\u0436\u0435 \u0437\u0430\u043D\u044F\u0442\u044B.",
    siteNamesPresent: "\u0412\u0441\u0435 \u0438\u043C\u0435\u043D\u0430 \u0443\u0436\u0435 \u0435\u0441\u0442\u044C \u043D\u0430 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435.",
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
    noParentSlot: "Ancestry\u3067\u306F\u4E21\u89AA\u306E\u6B04\u304C\u4E21\u65B9\u57CB\u307E\u3063\u3066\u3044\u308B\u3002",
    siteNamesPresent: "\u3069\u306E\u540D\u524D\u3082\u30DA\u30FC\u30B8\u4E0A\u306B\u3059\u3067\u306B\u3042\u308B\u3002",
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
    noParentSlot: "Ancestry \u4E0A\u7684\u7236\u6BCD\u4F4D\u7F6E\u90FD\u5DF2\u5360\u7528\u3002",
    siteNamesPresent: "\u9875\u9762\u4E0A\u5DF2\u7ECF\u6709\u8FD9\u4E9B\u540D\u5B57\u3002",
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
  var listeners = /* @__PURE__ */ new Set();
  var applyLanguage = (next) => {
    if (next === language) {
      return;
    }
    language = next;
    for (const listener of listeners) {
      listener();
    }
  };
  var onLanguage = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
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

  // extensions/treeviz-connector/src/log.ts
  var LIMIT = 200;
  var lines = [];
  var listeners2 = /* @__PURE__ */ new Set();
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
    listeners2.forEach((listener) => listener());
  };
  var recentLogLines = () => lines.slice(-12);
  var subscribeLog = (listener) => {
    listeners2.add(listener);
    return () => listeners2.delete(listener);
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
  var fieldByTitle = /* @__PURE__ */ new Map();
  var editorStep = () => {
    try {
      return new URL(window.location.href).searchParams.get("step") || "essentials";
    } catch {
      return "essentials";
    }
  };
  var namedControl = (form, name) => {
    const node = form.querySelector(`[name="${CSS.escape(name)}"]`);
    if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement) {
      return node;
    }
    return null;
  };
  var controlValue = (form, name) => namedControl(form, name)?.value.trim() || "";
  var joinParts = (parts) => parts.map((part) => part?.trim() || "").filter(Boolean).join(", ");
  var pushFact = (facts, title, value, field) => {
    if (field) {
      fieldByTitle.set(factTitleKey(title), field);
    }
    const clean = value.trim();
    if (!title || !clean || clean === "Y") {
      return;
    }
    facts.push({ title, value: clean });
  };
  var eachPresent = (form, base, visit) => {
    for (let index = 0; index < 30; index += 1) {
      if (!namedControl(form, `${base}${index}`)) {
        break;
      }
      visit(String(index));
    }
  };
  var FACT_TYPE_TITLE = {
    BIRT: "Birth",
    DEAT: "Death",
    MARR: "Marriage",
    OCCU: "Occupation",
    EDUC: "Education",
    RELI: "Religion",
    BURI: "Burial",
    CHR: "Christening",
    BAPM: "Baptism",
    RESI: "Residence",
    NATI: "Nationality",
    TITL: "Title",
    ADDR: "Address"
  };
  var FAVORITE_FIELDS = [
    ["favoriteInterestsHeader", "Interests"],
    ["favoriteActivitiesHeader", "Activities"],
    ["favoriteMusicHeader", "Music"],
    ["favoriteMoviesHeader", "Movies"],
    ["favoriteTVShowsHeader", "TV shows"],
    ["favoriteBooksHeader", "Books"],
    ["favoriteSportsHeader", "Sports"],
    ["favoriteRestaurantsHeader", "Restaurants"],
    ["favoriteFoodHeader", "Food"],
    ["favoritePeopleHeader", "People"],
    ["favoriteGetawaysHeader", "Getaways"],
    ["favoriteQuotesHeader", "Quotes"]
  ];
  var roleOf = (label2) => {
    const key = label2.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase().trim();
    if (/^(father|mother|parent|apa|anya|apja|anyja)$/.test(key)) {
      return "parents";
    }
    if (/^(husband|wife|spouse|ferj|ferje|feleseg|felesege|hazastars|hazastarsa)$/.test(key)) {
      return "spouses";
    }
    if (/^(son|daughter|child|fia|lanya|gyermek|gyermeke)$/.test(key)) {
      return "children";
    }
    return void 0;
  };
  var readEditorSections = (form) => {
    fieldByTitle.clear();
    const facts = [];
    const relatives = { parents: [], spouses: [], children: [] };
    const single = [
      ["nickname", "Nickname"],
      ["formerName", "Former name"],
      ["marriedName", "Married name"],
      ["prefix", "Prefix"],
      ["suffix", "Suffix"],
      ["religiousName", "Religious name"],
      ["godparents", "Godparents"],
      ["causeOfDeath", "Cause of Death"],
      ["religion", "Religion"],
      ["nationalitiesHeader", "Nationality"],
      ["languages", "Language"],
      ["politicsHeader", "Political"],
      ["height", "Height"],
      ["weight", "Weight"],
      ["hairColor", "Hair color"],
      ["eyeColor", "Eye color"],
      ["physical", "Physical description"],
      ["biography", "Biography"],
      ["biographyText", "Biography"]
    ];
    for (const [name, title] of single) {
      if (namedControl(form, name)) {
        pushFact(facts, title, controlValue(form, name), name);
      }
    }
    pushFact(
      facts,
      "Christening",
      joinParts([composedDate("christeningDate", form), controlValue(form, "christeningPlace")]),
      namedControl(form, "christeningPlace") ? "christeningPlace" : void 0
    );
    pushFact(
      facts,
      "Burial",
      joinParts([composedDate("burialDate", form), controlValue(form, "burialPlace")]),
      namedControl(form, "burialPlace") ? "burialPlace" : void 0
    );
    eachPresent(form, "addressAddressOne", (index) => {
      pushFact(
        facts,
        "Address",
        joinParts([
          controlValue(form, `addressAddressOne${index}`),
          controlValue(form, `addressAddressTwo${index}`),
          controlValue(form, `addressCity${index}`),
          controlValue(form, `addressZip${index}`),
          controlValue(form, `addressCountry${index}`),
          composedDate(`addressDate${index}`, form)
        ]),
        `addressAddressOne${index}`
      );
    });
    eachPresent(form, "contactEmail", (index) => {
      pushFact(facts, "Email", controlValue(form, `contactEmail${index}`), `contactEmail${index}`);
    });
    eachPresent(form, "contactPhone", (index) => {
      pushFact(facts, "Phone", controlValue(form, `contactPhone${index}`), `contactPhone${index}`);
    });
    eachPresent(form, "contactFax", (index) => {
      pushFact(facts, "Fax", controlValue(form, `contactFax${index}`), `contactFax${index}`);
    });
    eachPresent(form, "contactWebAddress", (index) => {
      pushFact(
        facts,
        "Web Address",
        joinParts([
          controlValue(form, `contactWebUsername${index}`),
          controlValue(form, `contactWebAddress${index}`)
        ]),
        `contactWebAddress${index}`
      );
    });
    eachPresent(form, "workHeader", (index) => {
      pushFact(
        facts,
        "Occupation",
        joinParts([
          controlValue(form, `workHeader${index}`),
          controlValue(form, `workPlace${index}`),
          controlValue(form, `workNote${index}`),
          composedDate(`workDate${index}`, form)
        ]),
        `workHeader${index}`
      );
    });
    eachPresent(form, "educationHeader", (index) => {
      pushFact(
        facts,
        "Education",
        joinParts([
          controlValue(form, `educationHeader${index}`),
          controlValue(form, `educationPlace${index}`),
          controlValue(form, `educationNote${index}`),
          composedDate(`educationDate${index}`, form)
        ]),
        `educationHeader${index}`
      );
    });
    for (const [name, title] of FAVORITE_FIELDS) {
      pushFact(facts, title, controlValue(form, name), name);
    }
    eachPresent(form, "citationSource", (index) => {
      pushFact(
        facts,
        "Citation",
        joinParts([
          controlValue(form, `citationSource${index}`),
          controlValue(form, `citationDescription${index}`),
          controlValue(form, `citationPage${index}`),
          composedDate(`citationDate${index}`, form)
        ]),
        `citationDescription${index}`
      );
    });
    eachPresent(form, "factType", (index) => {
      const type = controlValue(form, `factType${index}`);
      const title = FACT_TYPE_TITLE[type] || controlValue(form, `factHeader${index}`) || type;
      if (type === "DEAT" && namedControl(form, `causeOfDeath${index}`)) {
        pushFact(
          facts,
          "Cause of Death",
          controlValue(form, `causeOfDeath${index}`),
          `causeOfDeath${index}`
        );
      }
      if (title === "Birth" || title === "Death" || title === "Marriage") {
        return;
      }
      if (namedControl(form, `factHeader${index}`) || namedControl(form, `factPlace${index}`)) {
        pushFact(
          facts,
          title,
          joinParts([
            controlValue(form, `factHeader${index}`),
            controlValue(form, `factPlace${index}`),
            controlValue(form, `causeOfDeath${index}`),
            composedDate(`factDate${index}`, form)
          ]),
          namedControl(form, `factHeader${index}`) ? `factHeader${index}` : `factPlace${index}`
        );
      }
    });
    if (editorStep() === "biography") {
      const area = form.querySelector("textarea");
      if (area instanceof HTMLTextAreaElement && area.name) {
        pushFact(facts, "Biography", area.value, area.name);
      }
    }
    if (editorStep() === "family") {
      for (const label2 of Array.from(form.querySelectorAll(".FL_Label"))) {
        const role = label2.nextElementSibling;
        const kind = role ? roleOf(role.textContent || "") : void 0;
        const name = label2.textContent?.trim() || "";
        if (kind && name) {
          relatives[kind].push(name);
        }
      }
    }
    return { facts, relatives };
  };
  var factListDiffs = (siteFacts, treeFacts) => diffFactValues(siteFacts, treeFacts, true);
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
  var factRow = (type) => {
    const form = activeForm() ?? document;
    for (let index = 0; index < 30; index += 1) {
      if (!namedControl(form, `factType${index}`)) {
        return void 0;
      }
      if (controlValue(form, `factType${index}`) === type) {
        return String(index);
      }
    }
    return void 0;
  };
  var fieldsFor = (person, keys) => {
    const fields = [];
    const form = activeForm() ?? document;
    const birthRow = factRow("BIRT");
    const deathRow = factRow("DEAT");
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
      fields.push(
        ...dateFields(birthRow && !namedControl(form, "gdp_firstDateYear_birthDate") ? `factDate${birthRow}` : "birthDate", person.birthDate)
      );
    }
    if (keys.includes("birthPlace") && person.birthPlace) {
      const id = birthRow && !namedControl(form, "birthPlace") ? `factPlace${birthRow}` : "birthPlace";
      fields.push({ id, value: person.birthPlace });
    }
    if (keys.includes("deathDate")) {
      fields.push(
        ...dateFields(deathRow && !namedControl(form, "gdp_firstDateYear_deathDate") ? `factDate${deathRow}` : "deathDate", person.deathDate)
      );
    }
    if (keys.includes("deathPlace") && person.deathPlace) {
      const id = deathRow && !namedControl(form, "deathPlace") ? `factPlace${deathRow}` : "deathPlace";
      fields.push({ id, value: person.deathPlace });
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
    const formRoot = activeForm();
    const sameForm = Boolean(
      form && (formPersonId() === personId || onEditorPage() && urlPersonId() === personId)
    );
    const sections = formRoot && sameForm ? readEditorSections(formRoot) : void 0;
    const keep = /* @__PURE__ */ new Set();
    if (formRoot && namedControl(formRoot, "firstName")) {
      ["name", "sex", "birthDate", "birthPlace", "deathDate", "deathPlace"].forEach(
        (key) => keep.add(key)
      );
    }
    if (formRoot && (namedControl(formRoot, "marriagePlace0") || namedControl(formRoot, "gdp_firstDateYear_marriageDate0"))) {
      keep.add("marriageDate");
      keep.add("marriagePlace");
    }
    if (formRoot) {
      for (let index = 0; index < 30; index += 1) {
        if (!namedControl(formRoot, `factType${index}`)) {
          break;
        }
        const type = controlValue(formRoot, `factType${index}`);
        if (type === "DEAT" && form) {
          form.deathDate = composedDate(`factDate${index}`, formRoot) || form.deathDate;
          form.deathPlace = controlValue(formRoot, `factPlace${index}`) || form.deathPlace;
          keep.add("deathDate");
          keep.add("deathPlace");
        }
        if (type === "BIRT" && form) {
          form.birthDate = composedDate(`factDate${index}`, formRoot) || form.birthDate;
          form.birthPlace = controlValue(formRoot, `factPlace${index}`) || form.birthPlace;
          keep.add("birthDate");
          keep.add("birthPlace");
        }
      }
    }
    const diffs = form && sameForm ? diffPerson(form, person, writable).filter((diff) => keep.has(diff.key)) : [];
    if (sections) {
      const relevant = (person.facts ?? []).filter(
        (fact) => fieldByTitle.has(factTitleKey(fact.title))
      );
      diffs.push(...factListDiffs(sections.facts, relevant));
    }
    if (sections && editorStep() === "family") {
      const namesOf = (ids) => (ids ?? []).map((id) => personIn(tree, id)?.name || "").filter(Boolean);
      const groups = [
        ["parents", person.parentIds],
        ["spouses", person.spouseIds]
      ];
      for (const [key, ids] of groups) {
        const diff = diffNameList(key, sections.relatives[key], namesOf(ids));
        if (diff) {
          diffs.push(diff);
        }
      }
    }
    void ask({
      type: "connector:save-site",
      snapshot: {
        source: "myheritage",
        sourceTreeId: siteId ?? tree.sourceTreeId ?? "",
        sourcePersonId: person.sourcePersonId,
        readAt: Date.now(),
        layoutKnown: sameForm,
        diffs
      }
    });
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
      onOpenEditor: sameForm ? void 0 : () => {
        patchPanel({ busy: true });
        void openEditor(personId, siteId).then((opened) => {
          if (opened) {
            showTree(tree, personId, siteId, cachedAt);
          } else {
            patchPanel({ busy: false, status: t("layout") });
          }
        });
      },
      onUpdateSite: sameForm ? (diff) => {
        if (diff.key === "parents" || diff.key === "spouses" || diff.key === "children") {
          patchPanel({ status: t("relativesNotWritten") });
          return;
        }
        void writeSelected(person, diff);
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
  };
  var writeSelected = async (person, diff) => {
    if (!navigator.onLine) {
      patchPanel({ status: t("offline") });
      return;
    }
    let fields = fieldsFor(person, [diff.key]);
    if (diff.key === "fact" && diff.label && diff.treeviz) {
      const id = fieldByTitle.get(factTitleKey(diff.label));
      fields = id ? [{ id, value: diff.treeviz }] : [];
    }
    if (!fields.length) {
      patchPanel({ status: t("factNotWritten") });
      return;
    }
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
  void languageReady.then(() => {
    tick();
    window.setInterval(tick, 1e3);
    onLanguage(() => {
      href = "";
      tick();
    });
  });
  var EDITOR_STEPS = [
    { step: "essentials", anyOf: ["firstName", "lastName"] },
    { step: "family", anyOf: [] },
    { step: "contact", anyOf: ["contactEmail0", "contactPhone0", "addressAddressOne0"] },
    { step: "work", anyOf: ["workHeader0"] },
    { step: "education", anyOf: ["educationHeader0"] },
    { step: "favorites", anyOf: ["favoriteInterestsHeader"] },
    { step: "personal", anyOf: ["religion", "height", "hairColor"] },
    { step: "citations", anyOf: ["citationSource0", "citationDescription0"] },
    { step: "facts", anyOf: ["factType0"] },
    { step: "biography", anyOf: [] }
  ];
  var editorCheckUrl = (step) => {
    if (onEditorPage()) {
      const url2 = new URL(location.href);
      url2.searchParams.set("step", step);
      return url2.toString();
    }
    const parsed = parseMyHeritageLocation(location.href);
    if (!parsed?.siteId || !parsed.personId) {
      return void 0;
    }
    const url = new URL("/FP/edit-profile.php", location.origin);
    url.searchParams.set("s", parsed.siteId);
    url.searchParams.set("indID", parsed.personId.replace(/[^\d]/g, ""));
    url.searchParams.set("origin", "ProfilePage");
    url.searchParams.set("step", step);
    return url.toString();
  };
  var probeFocus = (doc) => {
    const form = doc.querySelector("#editProfileForm");
    if (form instanceof HTMLFormElement) {
      return form;
    }
    return doc.querySelector("#profile-page-root") || doc.querySelector("main") || doc.body;
  };
  var probeMyHeritage = async () => {
    const lines2 = [];
    let html = "";
    const remember = (doc, step) => {
      if (html) {
        return;
      }
      html = `
[${step}]
${htmlSkeleton(probeFocus(doc))}`;
    };
    if (!onEditorPage()) {
      const parsed = parseMyHeritageLocation(location.href);
      const root = document.querySelector("#profile-page-root");
      lines2.push({
        ok: Boolean(parsed?.siteId && parsed.personId),
        name: "profile url",
        detail: parsed?.personId ? `indID ${parsed.personId}` : location.pathname
      });
      lines2.push({
        ok: root instanceof HTMLElement && (root.childElementCount > 0 || Boolean(root.shadowRoot)),
        name: "#profile-page-root",
        detail: root instanceof HTMLElement ? `${root.childElementCount} children${root.shadowRoot ? " shadow" : ""}` : "absent"
      });
      if (!(root instanceof HTMLElement) || root.childElementCount === 0) {
        remember(document, "profile");
      }
    }
    if (!editorCheckUrl("essentials")) {
      const report2 = formatProbe(
        `myheritage ${location.pathname}`,
        [...lines2, { ok: false, name: "edit-profile.php" }],
        html || htmlSkeleton(probeFocus(document))
      );
      connectorLog("probe", report2);
      return report2;
    }
    for (const step of EDITOR_STEPS) {
      const url = editorCheckUrl(step.step);
      if (!url) {
        continue;
      }
      let doc = document;
      if (!onEditorPage() || editorStep() !== step.step) {
        try {
          const response = await fetch(url, { credentials: "include" });
          const text = await response.text();
          doc = new DOMParser().parseFromString(text, "text/html");
          lines2.push({ ok: response.ok, name: `${step.step} fetch`, detail: String(response.status) });
        } catch (error) {
          lines2.push({
            ok: false,
            name: `${step.step} fetch`,
            detail: error instanceof Error ? error.message : "failed"
          });
          continue;
        }
      }
      const form = doc.querySelector("#editProfileForm");
      lines2.push({ ok: form instanceof HTMLFormElement, name: `${step.step} #editProfileForm` });
      if (!(form instanceof HTMLFormElement)) {
        remember(doc, step.step);
        continue;
      }
      if (step.step === "family") {
        const labels = form.querySelectorAll(".FL_Label").length;
        lines2.push({ ok: true, name: "family .FL_Label", detail: String(labels) });
        continue;
      }
      if (step.step === "biography") {
        const area = form.querySelector("textarea");
        lines2.push({ ok: area instanceof HTMLTextAreaElement, name: "biography textarea" });
        if (!(area instanceof HTMLTextAreaElement)) {
          remember(doc, "biography");
        }
        continue;
      }
      const found = step.anyOf.filter((name) => form.querySelector(`[name="${CSS.escape(name)}"]`));
      lines2.push({
        ok: found.length > 0,
        name: step.step,
        detail: found.length ? found.join(",") : `expected ${step.anyOf.join("|")}`
      });
      if (!found.length) {
        remember(doc, step.step);
      }
    }
    const report = formatProbe(`myheritage ${location.pathname}`, lines2, html || void 0);
    connectorLog("probe", report);
    return report;
  };
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const body = message;
    if (body?.type !== "connector:probe") {
      return;
    }
    void probeMyHeritage().then((report) => sendResponse({ ok: true, report }));
    return true;
  });
})();
