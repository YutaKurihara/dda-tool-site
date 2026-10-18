# DDA Tool サイト(GitHub Pages 用)

PWTT のサイト(https://oballinger.github.io/PWTT/)と同様の、
GEE App 埋め込み + 手法解説の静的サイト。ビルド不要の素の HTML/CSS。

## ページ構成

| ファイル | 内容 |
|---|---|
| `index.html` | ホーム = ツールの目的・Map/Estimate/Report の 3 機能・ダッシュボード(GEE App 埋め込み)・「数値の読み方」(観測と推定の区別) |
| `flood.html` | Flood Mapping and Damage Assessment — 冒頭は目的・提供物・4 ステップ・Observed/Inferred/Unknown 表・限界、後半 Technical details(dB 差分検知・3 区分・FwDET・パラメータ・Changelog) |
| `landslide.html` | Landslide Detection and Impact Assessment — 全損仮定・Potential Road Blockages を前に、検出手法は Technical details |
| `earthquake.html` | Potential Building Collapse Detection — Palu 検証の Precision 24 % / Recall 62 % を正面に、RV-PWTT は Technical details |
| `forestfire.html` | Forest Fire Monitoring and Burned Area Mapping — Part A 熱源監視(VIIRS の面積は「active-fire detection footprint」と読む)、Part B 焼失域(S1 時系列、status 3 段階、Stage 2 算定) |
| `datacheck.html` | Data Quality and Damage Estimation Verification — App 埋め込み + 何が確認できるか + ソースは折りたたみ |
| `about.html` | User Manual — 1 Overview / 2 Quick Start / 3 Requirements / 4–6 Step 1–3 / 7 Data verification / 8 Troubleshooting / Appendix A スクリプト・B Asset・C 計算式 |
| `code/07_datacheck.js` | datacheck.html が fetch するコードのコピー。**01_shared 側を更新したら再コピーすること** |
| `assets/config.js` | **GEE App の URL を設定する唯一のファイル**(dashboard / datacheck / forestfire) |
| `assets/style.css` | 共通スタイル(PWTT/Quarto 風・学術ドキュメント調) |
| `assets/img/manual/` | Manual の操作画面 16 枚(2026-10-18 撮影、赤枠と番号は scratchpad の manual_shots.py で付与。原本は Pictures/Screenshots) |

2026-10-17 の全面再構成(外部レビュー「サイト全体を確認.pdf」対応): 全ページを
「何ができるか → 提供物 → How it works → 精度と限界 → 出力 → Technical details」の順に並べ替え、
観測／推定／仮定(Inferred flood・Potential collapse・Active-fire footprint・全損仮定)を明示、
用語を「estimated direct physical damage」「preliminary tables formatted to support DIBI/Jitupasna」に統一。
技術情報は削除せず後半に残してある。**VIIRS App 本体のキャプション(burned area)は未変更**(コード側の作業)。

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
