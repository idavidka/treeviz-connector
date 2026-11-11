# @treeviz/treeviz-connector

Chrome extension that compares the person open on Ancestry or MyHeritage with the same person in a TreeViz tree. Confirmed fields can be written either way. Part of [TreeViz](https://treeviz.com).

The extension is unpacked for local development and packed into `treeviz-connector.zip` for the Chrome Web Store.

## Load it locally

```bash
npm install
npm run build
```

In Chrome, open `chrome://extensions`, turn on Developer mode, and choose **Load unpacked**. Select this directory.

`manifest.json` keeps the `key` field so the unpacked extension id stays stable. That field is a public key, not a store secret.

## Chrome package

```bash
npm run zip
```

Each run raises the patch version by one in `package.json` and `manifest.json`, builds the extension, and writes `treeviz-connector.zip`. The zip starts at **4.0.0** and the first pack is **4.0.1**.

The store package does not contain `key`. Chrome Web Store rejects a package that includes it. The source manifest still has the key for local loads.

The zip contains the manifest, popup, icons, the page script, and the built `dist` files. Source, samples, and the key stay out.

## Version

The version is `major.minor.patch` and starts at `4.0.0`. `npm run zip` is the only step that advances it, and it advances the patch only.

## License

MIT. See [LICENSE](LICENSE).
