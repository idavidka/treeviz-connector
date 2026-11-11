import { execSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const writeVersion = (path, version) => {
	const text = readFileSync(path, "utf8");
	const next = text.replace(/"version": "[^"]+"/, `"version": "${version}"`);
	if (next === text) {
		throw new Error(`No version field in ${path}`);
	}
	writeFileSync(path, next);
};

const bumpPatch = (version) => {
	const parts = version.split(".").map((part) => Number(part));
	if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
		throw new Error(`Expected major.minor.patch, got ${version}`);
	}
	parts[2] += 1;
	return parts.join(".");
};

const pkgPath = join(root, "package.json");
const manifestPath = join(root, "manifest.json");
const current = readJson(pkgPath).version;
const version = bumpPatch(current);

execSync("npm run build", { cwd: root, stdio: "inherit" });

writeVersion(pkgPath, version);
writeVersion(manifestPath, version);

const manifest = readJson(manifestPath);
delete manifest.key;

const stage = join(tmpdir(), `treeviz-connector-${version}`);
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
writeFileSync(join(stage, "manifest.json"), `${JSON.stringify(manifest, null, "\t")}\n`);
for (const name of ["popup.html", "popup.css"]) {
	cpSync(join(root, name), join(stage, name));
}
cpSync(join(root, "icons"), join(stage, "icons"), { recursive: true });
cpSync(join(root, "page"), join(stage, "page"), { recursive: true });
cpSync(join(root, "dist"), join(stage, "dist"), { recursive: true });

const zipPath = join(root, "treeviz-connector.zip");
rmSync(zipPath, { force: true });
execSync(`zip -r ${JSON.stringify(zipPath)} .`, { cwd: stage, stdio: "inherit" });
rmSync(stage, { recursive: true, force: true });

console.log(`Packed ${zipPath} at ${version} without the manifest key.`);
