export type ProbeLine = { ok: boolean; name: string; detail?: string };

/** Tag, id, class, and control name only. Field values stay out of the log. */
export const htmlSkeleton = (root: ParentNode, limit = 7000): string => {
	const lines: string[] = [];
	const walk = (node: Element, depth: number): void => {
		if (depth > 7 || lines.join("\n").length > limit) {
			return;
		}
		const id = node.id ? `#${node.id}` : "";
		const name = node.getAttribute("name");
		const type = node.getAttribute("type");
		const className =
			typeof node.className === "string"
				? node.className.trim().split(/\s+/).filter(Boolean).slice(0, 3)
				: [];
		const cls = className.length ? `.${className.join(".")}` : "";
		lines.push(
			`${"  ".repeat(depth)}<${node.tagName.toLowerCase()}${id}${
				name ? `[name=${name}]` : ""
			}${type ? `[type=${type}]` : ""}${cls}>`
		);
		for (const child of Array.from(node.children).slice(0, 30)) {
			walk(child, depth + 1);
		}
	};
	if (root instanceof Element) {
		walk(root, 0);
	}
	return lines.join("\n").slice(0, limit);
};

export const formatProbe = (
	title: string,
	lines: ProbeLine[],
	html?: string
): string => {
	const body = lines
		.map(
			(line) =>
				`${line.ok ? "ok" : "MISSING"} ${line.name}${line.detail ? ` ${line.detail}` : ""}`
		)
		.join("\n");
	return html ? `${title}\n${body}\n--- html ---\n${html}` : `${title}\n${body}`;
};
