# DDA Tool サイト(GitHub Pages 用)

PWTT のサイト(https://oballinger.github.io/PWTT/)と同様の、
GEE App 埋め込み + 手法解説の静的サイト。ビルド不要の素の HTML/CSS。

## ページ構成

| ファイル | 内容 |
|---|---|
| `index.html` | ホーム = ダッシュボード(GEE App を全画面 iframe 埋め込み) |
| `flood.html` | 洪水 — Sentinel-1 dB 差分検知(flood/dry/unknown の 3 区分)+ FwDET 浸水深・推論域の解説 |
| `landslide.html` | 土砂災害 — Sentinel-2 NDVI 変化検知と道路寸断点の解説 |
| `earthquake.html` | 地震 — RV-PWTT 建物倒壊検知の解説 |
| `forestfire.html` | 森林火災 — VIIRS 日次モニタ(App 埋め込み)と、§5 に Sentinel-1 時系列の焼失域検知器(05_burnscar_detection.js) |
| `datacheck.html` | Data Check — App 埋め込み + 07_datacheck.js のソースコード(Prism でハイライト) |
| `about.html` | 運用手順書 — 3 ステージのパイプライン・Asset の配置・コード体系(Kemendagri と DIBI の BPS)・トラブルシューティング |
| `code/07_datacheck.js` | datacheck.html が fetch するコードのコピー。**01_shared 側を更新したら再コピーすること** |
| `assets/config.js` | **GEE App の URL を設定する唯一のファイル**(dashboard / datacheck / forestfire) |
| `assets/style.css` | 共通スタイル(PWTT/Quarto 風・学術ドキュメント調) |

干ばつ(drought.html)は 2026-10-17 に掲載を取り下げた。`03_dashboard/03_drought.js` が
ツールから外れたため。ページ本体は `../site_archive/` に退避してあり、公開されない。

## 公開手順

### 1. GEE App を公開して URL を設定

Code Editor で対象スクリプトを開き **Apps → NEW APP → Publish**
(App Source Code は「Repository script path」を選ぶと保存のたびに自動反映):

| App | 元スクリプト | config.js のキー |
|---|---|---|
| ダッシュボード | `03_dashboard/01_dashboard.js` | `dashboard` |
| Data Check | `01_shared/07_datacheck.js` | `datacheck` |
| 森林火災モニタ | `03_dashboard/02_forestfire.js` | `forestfire` |

※ 焼失域検知器(`02_event/05_burnscar_detection.js`)は Export を伴う Stage 1 系なので
App にはせず、forestfire.html の §5 に手法を記載する。

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
- 内容の出典: `コード/README.md`・各スクリプトのヘッダーコメント・
  `Reference/07_validation/README.md`(凍結記録)。**2026-10-17 時点のツールに同期済み**
  (境界 BIG adm1–4、人口 InaRISK、洪水の dB 判定／3 区分／推論域／観測のみマスク、
  土砂の寸断テーブル無条件投入、Sentinel-1 焼失域検知器)。手法を変えたらこのサイトの
  該当ページも更新すること。
- インドネシア語版を作る場合は各 html を `id/` サブフォルダに複製して翻訳し、
  ナビに言語スイッチを足すのが最小の作り。
