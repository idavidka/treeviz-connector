export const ask = (message) => new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
            resolve({});
            return;
        }
        resolve((response ?? {}));
    });
});
export const loadIndex = async () => {
    const response = await ask({ type: "connector:get-index" });
    return response.index;
};
export const matchTrees = (index, source, sourceTreeId, personId) => {
    if (!index) {
        return [];
    }
    const id = personId.replace(/[^\d]/g, "");
    return index.trees.filter((tree) => {
        if (tree.source !== source) {
            return false;
        }
        if (sourceTreeId &&
            tree.sourceTreeId &&
            sourceTreeId.toLowerCase() !== tree.sourceTreeId.toLowerCase()) {
            return false;
        }
        return tree.persons.some((person) => person.sourcePersonId === id);
    });
};
export const personIn = (tree, personId) => {
    const id = personId.replace(/[^\d]/g, "");
    return tree.persons.find((person) => person.sourcePersonId === id);
};
export const preferActive = (trees) => {
    if (trees.length === 1) {
        return trees[0];
    }
    return trees.find((tree) => tree.active);
};
