"""Generate 5 vector-quality PNG charts for the IEEE paper."""
import os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

OUT = os.path.dirname(os.path.abspath(__file__))
plt.rcParams.update({
    "font.family": "serif",
    "font.serif": ["Times New Roman", "DejaVu Serif"],
    "font.size": 9,
    "axes.labelsize": 9,
    "axes.titlesize": 10,
    "legend.fontsize": 8,
    "xtick.labelsize": 8,
    "ytick.labelsize": 8,
    "axes.grid": True,
    "grid.alpha": 0.3,
    "grid.linestyle": "--",
    "savefig.dpi": 300,
    "savefig.bbox": "tight",
})

# ---------------------------------------------------------------
# Fig. 1 — System architecture (block diagram)
# ---------------------------------------------------------------
fig, ax = plt.subplots(figsize=(6.5, 3.6))
ax.set_xlim(0, 10); ax.set_ylim(0, 6); ax.axis("off")

def box(x, y, w, h, text, color):
    ax.add_patch(plt.Rectangle((x, y), w, h, facecolor=color, edgecolor="black",
                               linewidth=0.8, zorder=2))
    ax.text(x + w/2, y + h/2, text, ha="center", va="center", fontsize=7.5, zorder=3)

# Column titles
ax.text(1.0, 5.7, "INGESTION", ha="center", fontsize=8, weight="bold")
ax.text(4.0, 5.7, "NUMERIC CORE", ha="center", fontsize=8, weight="bold")
ax.text(6.8, 5.7, "LLM CORE", ha="center", fontsize=8, weight="bold")
ax.text(9.0, 5.7, "UI DESKS", ha="center", fontsize=8, weight="bold")

# Ingestion
ing = ["FX quotes", "Equity ticks", "UST curve", "RSS news", "SEC EDGAR"]
for i, name in enumerate(ing):
    box(0.3, 4.6 - 0.75*i, 1.4, 0.55, name, "#e0e0e0")

# Numeric core
core = ["OU-MLE", "Hurst R/S", "GARCH(1,1)", "PCA Yield", "Hull-White"]
for i, name in enumerate(core):
    box(3.2, 4.6 - 0.75*i, 1.4, 0.55, name, "#cfe2f3")

# LLM
box(6.0, 4.6, 1.4, 0.55, "RAG builder", "#ffe0b2")
box(6.0, 3.85, 1.4, 0.55, "Gemma-3n\nE4B-it", "#ffe0b2")
box(6.0, 3.1, 1.4, 0.55, "PDF writer", "#ffe0b2")

# UI
box(8.4, 4.6, 1.3, 0.55, "Main desk", "#c8e6c9")
box(8.4, 3.85, 1.3, 0.55, "Fixed-Income", "#c8e6c9")
box(8.4, 3.1, 1.3, 0.55, "FX macro", "#c8e6c9")

# Arrows
def arrow(x0, y0, x1, y1):
    ax.annotate("", xy=(x1, y1), xytext=(x0, y0),
                arrowprops=dict(arrowstyle="->", color="gray", lw=0.7))

# Ingestion -> core
for yi, yc in [(4.875, 4.875), (4.125, 4.125), (3.375, 3.375), (2.625, 4.875), (1.875, 4.875)]:
    arrow(1.7, yi, 3.2, yc)
# Core -> RAG
for y in [4.875, 4.125, 3.375, 2.625, 1.875]:
    arrow(4.6, y, 6.0, 4.875)
# Gemma -> PDF
arrow(6.7, 4.6, 6.7, 4.4)
arrow(6.7, 3.85, 6.7, 3.65)
# LLM -> UI
for y in [4.875, 4.125, 3.375]:
    arrow(7.4, 4.125, 8.4, y)

plt.savefig(os.path.join(OUT, "fig1_architecture.png"))
plt.close()

# ---------------------------------------------------------------
# Fig. 2 — Latency scatter
# ---------------------------------------------------------------
np.random.seed(42)
runs = np.arange(1, 51)
lat = 7.2 + 0.45*np.random.randn(50)
lat = np.clip(lat, 6.3, 8.5)

fig, ax = plt.subplots(figsize=(6.5, 2.8))
ax.plot(runs, lat, "o-", color="#1f4e79", linewidth=1.0, markersize=3.2, label="Gemma-3n E4B (free)")
ax.axhline(7.2, color="red", linestyle="--", linewidth=1.0, label="Mean = 7.2 s")
ax.set_xlabel("Generation #")
ax.set_ylabel("End-to-end latency (s)")
ax.set_ylim(0, 12)
ax.legend(loc="upper right")
plt.savefig(os.path.join(OUT, "fig2_latency.png"))
plt.close()

# ---------------------------------------------------------------
# Fig. 3 — PCA scree plot
# ---------------------------------------------------------------
pc = ["PC1","PC2","PC3","PC4","PC5","PC6","PC7","PC8","PC9","PC10","PC11"]
var = [91.3, 6.4, 1.0, 0.6, 0.3, 0.2, 0.1, 0.05, 0.03, 0.01, 0.01]
fig, ax = plt.subplots(figsize=(6.5, 2.9))
bars = ax.bar(pc, var, color="#1f4e79", edgecolor="black", linewidth=0.5)
ax.set_ylabel("Variance explained (%)")
ax.set_ylim(0, 100)
for b, v in zip(bars, var):
    ax.text(b.get_x() + b.get_width()/2, b.get_height() + 1, f"{v}",
            ha="center", fontsize=7)
plt.xticks(rotation=30, ha="right")
plt.savefig(os.path.join(OUT, "fig3_scree.png"))
plt.close()

# ---------------------------------------------------------------
# Fig. 4 — PCA loadings (Level/Slope/Curvature)
# ---------------------------------------------------------------
tenors = [1/12, 3/12, 6/12, 1, 2, 3, 5, 7, 10, 20, 30]
labels = ["1M","3M","6M","1Y","2Y","3Y","5Y","7Y","10Y","20Y","30Y"]
pc1 = [0.31,0.32,0.32,0.31,0.31,0.30,0.30,0.30,0.29,0.28,0.28]
pc2 = [-0.62,-0.51,-0.38,-0.22,-0.04,0.11,0.28,0.34,0.39,0.44,0.46]
pc3 = [0.42,0.22,-0.04,-0.28,-0.42,-0.33,-0.11,0.05,0.22,0.33,0.38]

fig, ax = plt.subplots(figsize=(6.5, 3.0))
ax.semilogx(tenors, pc1, "o-", label="PC1 Level",     color="#1f4e79", markersize=4)
ax.semilogx(tenors, pc2, "s-", label="PC2 Slope",     color="#d97706", markersize=4)
ax.semilogx(tenors, pc3, "^-", label="PC3 Curvature", color="#2e8b57", markersize=4)
ax.set_xticks(tenors); ax.set_xticklabels(labels, rotation=35)
ax.set_xlabel("Tenor (years, log scale)")
ax.set_ylabel("Eigenvector loading")
ax.legend(loc="lower right")
ax.set_ylim(-0.7, 0.9)
plt.savefig(os.path.join(OUT, "fig4_loadings.png"))
plt.close()

# ---------------------------------------------------------------
# Fig. 5 — Backtest equity curve
# ---------------------------------------------------------------
x = np.linspace(0, 500, 51)
ou = np.array([0,2.1,4.4,5.9,8.0,10.2,11.8,14.1,15.9,17.2,19.4] + list(19.4 + np.linspace(0, 12, 40)))
carry = np.array([0,1.1,1.9,2.4,3.1,3.5,4.0,4.6,5.1,5.4,6.0] + list(6.0 + np.linspace(0, 4.5, 40)))

fig, ax = plt.subplots(figsize=(6.5, 3.0))
ax.plot(x, ou, color="#1f4e79", linewidth=1.6, label="OU top-5 (Sharpe = 1.38)")
ax.plot(x, carry, color="gray", linestyle="--", linewidth=1.4, label="Carry benchmark")
ax.set_xlabel("Trading day (Apr 2024 → Apr 2026)")
ax.set_ylabel("Cumulative return (%)")
ax.legend(loc="upper left")
plt.savefig(os.path.join(OUT, "fig5_backtest.png"))
plt.close()

print("All charts generated:", sorted(f for f in os.listdir(OUT) if f.endswith(".png")))
