# Hedgyyyboo — IEEE Conference Paper

**File:** `hedgyyyboo_ieee.tex`
**Class:** `IEEEtran` (conference mode), 2-column A4
**Pages:** ~8 once compiled
**Figures:** 5 (all TikZ/pgfplots, vector-quality)
**Tables:** 2
**References:** 38 (peer-reviewed + official data sources)

---

## 1. Quick compile — Overleaf (no install needed)

1. Go to <https://www.overleaf.com/project> → **New Project** → **Upload Project**.
2. Drag `hedgyyyboo_ieee.tex` in.
3. Top-right: set the compiler to **pdfLaTeX**.
4. Click **Recompile** → download the PDF.

Everything (IEEEtran, pgfplots, TikZ, amsmath, booktabs, hyperref) is already on Overleaf — no package setup required.

---

## 2. Compile locally on macOS

```bash
# Option A: Full MacTeX (~5 GB, everything included)
brew install --cask mactex

# Option B: BasicTeX (~100 MB) + extra packages
brew install --cask basictex
eval "$(/usr/libexec/path_helper)"
sudo tlmgr update --self
sudo tlmgr install ieeetran pgfplots pgf collection-fontsrecommended \
                   booktabs multirow hyperref xcolor amsmath cite \
                   algorithms algorithmic url
```

Then:

```bash
cd "/Users/prathmeshdeshmukh/Downloads/untitled folder/paper"
pdflatex hedgyyyboo_ieee.tex
pdflatex hedgyyyboo_ieee.tex        # second pass for cross-refs
open hedgyyyboo_ieee.pdf
```

---

## 3. Paper structure

| § | Section | What's in it |
|---|---------|--------------|
| I | Introduction | 3 open problems, 4 contributions (C1–C4) |
| II | Related Work | Stochastic models, factor models, vol, Neural SDEs, LLMs/RAG |
| III | System Architecture | TikZ diagram of 3-tier pipeline |
| IV | Mathematical Framework | OU-MLE, Hurst, GARCH, PCA, Hull–White, Heston, Neural SDE — all with derivations |
| V | LLM Integration | Gemma-3n system-prompt quirk, rate limiting, latency plot |
| VI | Experimental Setup | Data, hardware, metrics |
| VII | Results | PCA scree + loadings, OU table, backtest equity curve, GARCH coverage, latency |
| VIII | Discussion | Limitations, threats to validity |
| IX | Conclusion | — |
| – | References | 38 entries |

---

## 4. Figures (all vector TikZ/pgfplots)

1. **Fig. 1** — 3-tier architecture block diagram
2. **Fig. 2** — LLM latency scatter (50 runs, mean = 7.2 s)
3. **Fig. 3** — PCA scree plot (variance explained per PC)
4. **Fig. 4** — PCA loadings curve (Level / Slope / Curvature)
5. **Fig. 5** — Backtest equity curve vs. carry benchmark

---

## 5. Customise before submission

- **Author block**: replace `Prathmesh Deshmukh` / affiliation / email at line 30–34.
- **Conference name / copyright**: add `\IEEEoverridecommandlockouts` and `\pubid{...}` if the conference provides a copyright block.
- **Page limit**: typical IEEE conferences cap at 6 pages (incl. refs). If you overflow, remove Section II subsection D (Neural SDEs) and the corresponding math block — least load-bearing.
- **Ethics / data statement**: add if the conference requires it.

---

## 6. Sanity check before submitting

- [ ] All 5 figures render (no TikZ errors in log)
- [ ] No `Overfull \hbox` warnings > 20 pt
- [ ] Bibliography compiles clean
- [ ] Page count matches conference limit
- [ ] `\url{}` links in refs are live
- [ ] Spell-check (`aspell check hedgyyyboo_ieee.tex`)
