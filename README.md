# Stockgraphs

A small, fully client-side web app that loads **1-minute intraday** prices from **Finviz Elite** (`quote_export.ashx` CSV) and draws a **line chart** with [TradingView Lightweight Charts](https://github.com/tradingview/lightweight-charts). You can mark specific moments in time with **vertical green lines**, driven by URL query parameters or the in-app settings panel.

## What it does

- **Chart:** One line series of close prices for the requested symbol and range. CSV timestamps are parsed as **US Eastern** (`America/New_York`). **NY / AMS** buttons next to the chart switch **only** how the axis, crosshair, and line-time labels are shown (Amsterdam = `Europe/Amsterdam`); bar data and URL `lines` values stay the same Unix instants. The choice is stored in `localStorage`.
- **Vertical lines:** Optional Unix seconds (UTC instants). Each marker **snaps to the nearest bar** by time; baseline uses the close at the bar nearest the first `lines` value.
- **Settings panel:** Symbol, range, refresh, and vertical-line inputs live behind a **Settings** button in the header so the default view stays minimal.
- **Theme:** **Dark mode is the default.** Use the **Light / Dark** control to switch; the choice is stored in `localStorage`. The chart colors follow the same theme.
- **Shareable URLs:** The address bar is kept in sync with symbol, range, and line times (via `history.replaceState`), so you can bookmark or share a link that reproduces the same view.

## URL query parameters

All parameters are optional unless noted.

| Parameter | Aliases | Description |
|-----------|---------|-------------|
| `symbol` | `ticker` | Ticker symbol (default `AAPL`). |
| `range` | — | Intraday window for **1m** (Finviz `p=i1`) data: `1d`, `5d`, or `7d` (default `1d`). Invalid values fall back to `1d`. |
| `lines` | `at`, `timestamps`, `t` | Comma-separated **Unix seconds (UTC instants)** for vertical lines. Values greater than `1e12` are treated as **milliseconds** and converted to seconds. No extra timezone conversion is applied. |

Example:

```text
/?symbol=MSFT&range=5d&lines=1711900800,1711987200
```

## Data source and limitations

- Data comes from **Finviz Elite** CSV export: `https://elite.finviz.com/quote_export.ashx?t=…&p=i1&r=d1|d5|d7&auth=…` (`p=i1` = 1-minute bars; `r` = lookback). Configure the **`auth`** token in **Settings**; it is saved in **`localStorage`** for this origin only. Naive datetimes in the CSV are interpreted as **US Eastern** (`America/New_York`).
- The app **always** loads CSV through **`corsproxy.io`** (Finviz does not allow cross-origin browser requests). The relay sees your full Finviz URL (including `auth`); for stronger privacy run your own proxy and point the app at it (would require a small code change).

## Local development

```bash
npm install
npm run dev
```

In the app, open **Settings** and paste your Finviz Elite **export token** (`auth` from the `quote_export.ashx` URL). It is stored in **`localStorage`** in this browser only (not in the URL or git).

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

Use and modify as you like for your own projects. Finviz and TradingView are trademarks of their respective owners; this app is not affiliated with either.
