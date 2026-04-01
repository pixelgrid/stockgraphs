# Stockgraphs

A small, fully client-side web app that loads **1-minute intraday** stock prices from **Yahoo Finance** (unofficial chart API) and draws a **line chart** with [TradingView Lightweight Charts](https://github.com/tradingview/lightweight-charts). You can mark specific moments in time with **vertical green lines**, driven by URL query parameters or the in-app settings panel.

## What it does

- **Chart:** One line series of close prices for the requested symbol and range. The time axis shows clock times for intraday data (not only the calendar date).
- **Vertical lines:** Optional Unix timestamps (seconds; millisecond values are accepted and converted). Each time is snapped to the **nearest 1-minute bar** on the chart so lines align even if the exact second does not match Yahoo’s bar times.
- **Settings panel:** Symbol, range, refresh, and vertical-line inputs live behind a **Settings** button in the header so the default view stays minimal.
- **Theme:** **Dark mode is the default.** Use the **Light / Dark** control to switch; the choice is stored in `localStorage`. The chart colors follow the same theme.
- **Shareable URLs:** The address bar is kept in sync with symbol, range, and line times (via `history.replaceState`), so you can bookmark or share a link that reproduces the same view.

## URL query parameters

All parameters are optional unless noted.

| Parameter | Aliases | Description |
|-----------|---------|-------------|
| `symbol` | `ticker` | Ticker symbol (default `AAPL`). |
| `range` | — | Intraday window for **1m** data: `1d`, `5d`, or `7d` (default `1d`). Invalid values fall back to `1d`. |
| `lines` | `at`, `timestamps`, `t` | Comma-separated Unix times for vertical lines. Values greater than `1e12` are treated as **milliseconds** and converted to seconds. |

Example:

```text
/?symbol=MSFT&range=5d&lines=1711900800,1711987200
```

## Data source and limitations

- Data comes from Yahoo’s public chart endpoint (`query1.finance.yahoo.com`). It is **not** an official API and may change, rate-limit, or block requests.
- Browsers often block **direct** requests because of CORS. The app tries Yahoo first, then a public **CORS relay** (`corsproxy.io`) as a fallback. Relays can be unreliable; for production you may want your own proxy or another data provider.

## Local development

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Build and GitHub Pages

```bash
npm run build              # output in dist/, base path /
npm run build:gh-pages     # base path /stockgraphs/ (from package.json "name")
npm run deploy:gh-pages    # build:gh-pages + publish dist to gh-pages branch
```

For a repository name that differs from the `name` field in `package.json`, run `./scripts/deploy-github-pages.sh your-repo-name` or pass an explicit `--base` to `vite build`.

A GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) can build and deploy when you enable **Pages** with the **GitHub Actions** source in the repository settings.

## Stack

- React (TypeScript), Vite
- [lightweight-charts](https://www.npmjs.com/package/lightweight-charts) v5

## License

Use and modify as you like for your own projects. Yahoo and TradingView are trademarks of their respective owners; this app is not affiliated with either.
