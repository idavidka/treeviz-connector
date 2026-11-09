"use strict";
(() => {
  // extensions/treeviz-connector/src/content/treeviz.ts
  var hide = () => {
    document.getElementById("treeviz-connector-root")?.remove();
  };
  hide();
  window.setInterval(hide, 750);
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const body = message;
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
      let result = { ok: false, code: "closed" };
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
    window.setTimeout(finish, 5e3);
    return true;
  });
})();
