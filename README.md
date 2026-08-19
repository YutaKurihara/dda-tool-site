# DDA Tool サイト(GitHub Pages 用)

PWTT のサイト(https://oballinger.github.io/PWTT/)と同様の、
GEE App 埋め込み + 手法解説の静的サイト。ビルド不要の素の HTML/CSS。

## ページ構成

| ファイル | 内容 |
|---|---|
| `index.html` | ホーム = ダッシュボード(GEE App を全画面 iframe 埋め込み) |
| `flood.html` | 洪水 — Sentinel-1 変化検知 + FwDET 浸水深の解説 |
| `landslide.html` | 土砂災害 — Sentinel-2 NDVI 変化検知の解説 |
| `earthquake.html` | 地震 — RV-PWTT 建物倒壊検知の解説 |
| `datacheck.html` | Data Check — 07_datacheck.js のソースコード埋め込み(Prism でハイライト) |
| `about.html` | ツール概要・3ステージのパイプライン・被害額の計算式・データソース |
| `code/07_datacheck.js` | datacheck.html が fetch するコードのコピー。**01_shared 側を更新したら再コピーすること** |
| `assets/config.js` | **GEE App の URL を設定する唯一のファイル**(キーは dashboard のみ使用) |
| `assets/style.css` | 共通スタイル(PWTT/Quarto 風・学術ドキュメント調) |

## 公開手順

### 1. GEE App を公開して URL を設定

Code Editor で対象スクリプトを開き **Apps → NEW APP → Publish**
(App Source Code は「Repository script path」を選ぶと保存のたびに自動反映):

| App | 元スクリプト | config.js のキー |
|---|---|---|
| ダッシュボード | `03_dashboard/01_dashboard.js` | `dashboard` |

※ Data Check ページはアプリ埋め込みではなくソースコード表示のため App 不要。

発行された URL(`https://ee-kurihara-yt.projects.earthengine.app/view/...`)を
`assets/config.js` の `DDA_APPS` に貼る。URL が空のままだと、
ページには壊れた iframe の代わりに公開手順のカードが表示される。

※ GEE App は「Anyone can access」で公開すれば閲覧者の Google ログインは不要。

### 2. GitHub Pages にデプロイ

この `site/` フォルダだけを独立リポジトリにするのが簡単
(GEE_DIBI_Tool 全体は巨大な TIFF/PDF を含むため push しない):

```powershell
cd site
git init
git add .
git commit -m "DDA Tool site"
gh repo create dda-tool-site --public --source . --push
```

GitHub のリポジトリ設定 → **Pages → Branch: main / root** で公開。
URL は `https://<user>.github.io/dda-tool-site/`。

### 3. ローカル確認

ブラウザで `index.html` を直接開くだけで動く(iframe・KaTeX は
オンライン接続が必要)。

## メモ

- 数式は KaTeX(CDN)。オフライン環境では数式ソースがそのまま表示されるが
  ページは壊れない。
- 内容の出典: `コード/README.md`・各スクリプトのヘッダーコメント
  (2026-08-19 時点)。手法を変えたらこのサイトの該当ページも更新すること。
- インドネシア語版を作る場合は各 html を `id/` サブフォルダに複製して翻訳し、
  ナビに言語スイッチを足すのが最小の作り。
