import { INDEX_KEY } from "./protocol.js";
const status = document.querySelector("#status");
const trees = document.querySelector("#trees");
chrome.storage.local.get(INDEX_KEY, (items) => {
    const index = items[INDEX_KEY];
    if (!status || !trees) {
        return;
    }
    if (!index) {
        status.textContent = "Sign in to TreeViz and open a tree in this browser.";
        return;
    }
    const when = new Date(index.publishedAt).toLocaleString();
    status.textContent = `Signed-in cache from ${when}.`;
    for (const tree of index.trees) {
        const item = document.createElement("li");
        item.textContent = `${tree.name} (${tree.source}, ${tree.persons.length})`;
        trees.append(item);
    }
});
