import type { ConnectorIndex, ConnectorPerson, ConnectorTree } from "./protocol.js";

export const ask = (message: unknown): Promise<Record<string, unknown>> =>
	new Promise((resolve) => {
		chrome.runtime.sendMessage(message, (response) => {
			if (chrome.runtime.lastError) {
				resolve({});
				return;
			}
			resolve((response ?? {}) as Record<string, unknown>);
		});
	});

export const loadIndex = async (): Promise<ConnectorIndex | undefined> => {
	const response = await ask({ type: "connector:get-index" });
	return response.index as ConnectorIndex | undefined;
};

export const matchTrees = (
	index: ConnectorIndex | undefined,
	source: "ancestry" | "myheritage",
	sourceTreeId: string | undefined,
	personId: string
): ConnectorTree[] => {
	if (!index) {
		return [];
	}
	const id = personId.replace(/[^\d]/g, "");
	return index.trees.filter((tree) => {
		if (tree.source !== source) {
			return false;
		}
		if (sourceTreeId && tree.sourceTreeId && tree.sourceTreeId !== sourceTreeId) {
			return false;
		}
		return tree.persons.some((person) => person.sourcePersonId === id);
	});
};

export const personIn = (
	tree: ConnectorTree,
	personId: string
): ConnectorPerson | undefined => {
	const id = personId.replace(/[^\d]/g, "");
	return tree.persons.find((person) => person.sourcePersonId === id);
};

export const preferActive = (trees: ConnectorTree[]): ConnectorTree | undefined => {
	if (trees.length === 1) {
		return trees[0];
	}
	return trees.find((tree) => tree.active);
};
