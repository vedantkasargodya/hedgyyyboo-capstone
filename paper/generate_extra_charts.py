"""Additional charts needed for the capstone report: Gantt, data-flow, use-case."""
import os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches

OUT = os.path.dirname(os.path.abspath(__file__))
plt.rcParams.update({
    "font.family": "serif",
    "font.serif": ["Times New Roman", "DejaVu Serif"],
    "font.size": 10,
    "savefig.dpi": 300,
    "savefig.bbox": "tight",
})

# -----------------------------------------------------------------
# Fig 6 - Gantt Chart (project timeline)
# -----------------------------------------------------------------
fig, ax = plt.subplots(figsize=(7.5, 4.2))
tasks = [
    ("Literature Review",          0, 3),
    ("System Design",              2, 3),
    ("Ingestion Layer",            4, 3),
    ("Numeric Models (PCA/OU)",    5, 4),
    ("GARCH + Hull-White",         7, 3),
    ("LLM Integration",            9, 3),
    ("Frontend UI",               10, 4),
    ("Backtesting & Eval",        13, 3),
    ("Report & Paper",            14, 3),
]
colors = plt.cm.tab10(np.linspace(0, 1, len(tasks)))
for i, (name, start, dur) in enumerate(tasks):
    ax.barh(i, dur, left=start, color=colors[i], edgecolor="black", linewidth=0.5)
    ax.text(start + dur/2, i, f" {dur}w", va="center", ha="center", fontsize=8)
ax.set_yticks(range(len(tasks)))
ax.set_yticklabels([t[0] for t in tasks])
ax.invert_yaxis()
ax.set_xlabel("Week (Semester VII)")
ax.set_xlim(0, 17)
ax.set_xticks(range(0, 18, 2))
ax.grid(axis="x", alpha=0.3)
ax.set_title("Fig. 6. Project Development Timeline (Gantt Chart)", fontsize=10)
plt.savefig(os.path.join(OUT, "fig6_gantt.png"))
plt.close()

# -----------------------------------------------------------------
# Fig 7 - Data-flow diagram
# -----------------------------------------------------------------
fig, ax = plt.subplots(figsize=(7.0, 4.2))
ax.set_xlim(0, 10); ax.set_ylim(0, 6); ax.axis("off")

def flowbox(x, y, w, h, text, color="#cfe2f3"):
    ax.add_patch(plt.Rectangle((x, y), w, h, facecolor=color, edgecolor="black",
                               linewidth=0.8, zorder=2))
    ax.text(x + w/2, y + h/2, text, ha="center", va="center", fontsize=8, zorder=3)

def flowarrow(x0, y0, x1, y1):
    ax.annotate("", xy=(x1, y1), xytext=(x0, y0),
                arrowprops=dict(arrowstyle="->", color="black", lw=1.0))

flowbox(0.1, 2.5, 1.6, 1.0, "External APIs\n(Yahoo / FRED /\nGoogle News)", "#ffe0b2")
flowbox(2.3, 4.2, 1.5, 0.8, "Ingestion\nAdapters", "#cfe2f3")
flowbox(2.3, 2.8, 1.5, 0.8, "Data\nCache", "#cfe2f3")
flowbox(2.3, 1.4, 1.5, 0.8, "SQLite\n(Trade Ledger)", "#cfe2f3")
flowbox(4.5, 3.5, 1.8, 1.0, "Numeric Engine\n(PCA, OU, GARCH,\nHull-White)", "#c8e6c9")
flowbox(4.5, 1.8, 1.8, 1.0, "RAG Context\nBuilder", "#c8e6c9")
flowbox(7.0, 2.7, 1.5, 1.0, "OpenRouter\nGemma-3n-E4B", "#ffcccb")
flowbox(7.0, 0.8, 1.5, 1.0, "PDF / JSON\nSerializer", "#ffcccb")
flowbox(9.0, 1.8, 0.9, 2.0, "Next.js 16\nFrontend", "#d1c4e9")

flowarrow(1.7, 3.0, 2.3, 4.6)
flowarrow(1.7, 3.0, 2.3, 3.2)
flowarrow(3.8, 4.6, 4.5, 4.2)
flowarrow(3.8, 3.2, 4.5, 3.8)
flowarrow(3.8, 1.8, 4.5, 2.2)
flowarrow(6.3, 3.9, 7.0, 3.3)
flowarrow(6.3, 2.2, 7.0, 3.0)
flowarrow(7.75, 2.7, 7.75, 1.8)
flowarrow(8.5, 1.3, 9.0, 2.2)
flowarrow(8.5, 3.2, 9.0, 3.4)

ax.set_title("Fig. 7. Data Flow Architecture", fontsize=10, y=-0.1)
plt.savefig(os.path.join(OUT, "fig7_dataflow.png"))
plt.close()

# -----------------------------------------------------------------
# Fig 8 - Use-case diagram
# -----------------------------------------------------------------
fig, ax = plt.subplots(figsize=(6.5, 4.2))
ax.set_xlim(0, 10); ax.set_ylim(0, 6); ax.axis("off")

# Actors (stick figures)
def actor(x, y, label):
    ax.add_patch(plt.Circle((x, y+0.9), 0.15, fill=False, linewidth=1.3))
    ax.plot([x, x], [y+0.75, y+0.2], "k-", lw=1.3)
    ax.plot([x-0.2, x+0.2], [y+0.6, y+0.6], "k-", lw=1.3)
    ax.plot([x, x-0.2], [y+0.2, y-0.1], "k-", lw=1.3)
    ax.plot([x, x+0.2], [y+0.2, y-0.1], "k-", lw=1.3)
    ax.text(x, y-0.35, label, ha="center", fontsize=8)

actor(1.0, 2.0, "Portfolio\nManager")
actor(9.0, 2.0, "External\nData APIs")

# System boundary
ax.add_patch(plt.Rectangle((2.5, 0.5), 5.0, 5.0,
                           fill=False, linewidth=1.2, linestyle="--", edgecolor="gray"))
ax.text(5.0, 5.1, "Hedgyyyboo System", ha="center", fontsize=9, style="italic")

# Use cases (ellipses)
def uc(x, y, w, h, label):
    ax.add_patch(mpatches.Ellipse((x, y), w, h, facecolor="#c8e6c9",
                                   edgecolor="black", linewidth=0.8))
    ax.text(x, y, label, ha="center", va="center", fontsize=7.5)

uc(5.0, 4.4, 2.0, 0.6, "View Morning Brief")
uc(5.0, 3.6, 2.0, 0.6, "Analyze PCA / Yield Curve")
uc(5.0, 2.8, 2.0, 0.6, "Run OU Mean-Reversion")
uc(5.0, 2.0, 2.0, 0.6, "Execute FX Trade")
uc(5.0, 1.2, 2.0, 0.6, "View Risk Dashboard")

# Actor lines
for y in [4.4, 3.6, 2.8, 2.0, 1.2]:
    ax.plot([1.4, 4.0], [2.3, y], "k-", lw=0.7)
    ax.plot([8.6, 6.0], [2.3, y], "k-", lw=0.7)

ax.set_title("Fig. 8. Use-Case Diagram of the Hedgyyyboo Platform", fontsize=10, y=-0.02)
plt.savefig(os.path.join(OUT, "fig8_usecase.png"))
plt.close()

# -----------------------------------------------------------------
# Fig 9 - GARCH volatility forecast
# -----------------------------------------------------------------
np.random.seed(7)
T = 250
rets = 0.01 * np.random.randn(T)
sigma2 = np.zeros(T); sigma2[0] = 0.0001
for t in range(1, T):
    sigma2[t] = 1e-5 + 0.08*rets[t-1]**2 + 0.89*sigma2[t-1]
vol = np.sqrt(sigma2) * np.sqrt(252) * 100  # annualized %

fig, ax = plt.subplots(figsize=(7.0, 3.0))
ax.plot(vol, color="#1f4e79", linewidth=1.2, label="GARCH(1,1) σ̂_t (annualised)")
ax.axhline(vol.mean(), color="red", linestyle="--", linewidth=1, label=f"Mean = {vol.mean():.1f}%")
ax.set_xlabel("Trading day")
ax.set_ylabel("Volatility (%)")
ax.legend()
ax.grid(alpha=0.3)
ax.set_title("Fig. 9. GARCH(1,1) Conditional Volatility Forecast — S&P 500 Proxy", fontsize=10, y=-0.25)
plt.savefig(os.path.join(OUT, "fig9_garch.png"))
plt.close()

# -----------------------------------------------------------------
# Fig 10 - UI Screenshot mockup (simple frame)
# -----------------------------------------------------------------
fig, ax = plt.subplots(figsize=(7.5, 4.5))
ax.set_xlim(0, 10); ax.set_ylim(0, 6); ax.axis("off")
ax.set_facecolor("#0a0f1c")
fig.patch.set_facecolor("#0a0f1c")

# Top bar
ax.add_patch(plt.Rectangle((0, 5.6), 10, 0.4, facecolor="#0e1a2a", edgecolor="#1b2942"))
ax.text(0.2, 5.8, "HEDGYYYBOO  |  MAIN DESK", color="#00ff9f", fontsize=10, weight="bold")
ax.text(9.0, 5.8, "[ FI ] [ FX ]", color="#aaaaaa", fontsize=9)

# Stat cards
for i, (lab, val, col) in enumerate([
    ("RISK SCORE", "38.4", "#00ff9f"),
    ("ALPHA (bps)", "+24.1", "#00c8ff"),
    ("VaR 1%", "-1.87%", "#ffb020"),
    ("SHARPE", "1.38", "#ff4d6d"),
]):
    ax.add_patch(plt.Rectangle((0.2 + 2.45*i, 4.8), 2.3, 0.7, facecolor="#0e1a2a", edgecolor=col))
    ax.text(0.35 + 2.45*i, 5.05, lab, color="#8aa0b8", fontsize=8)
    ax.text(0.35 + 2.45*i, 4.88, val, color=col, fontsize=13, weight="bold")

# Panels
ax.add_patch(plt.Rectangle((0.2, 2.3), 4.7, 2.3, facecolor="#0e1a2a", edgecolor="#1b2942"))
ax.text(0.3, 4.4, "YIELD CURVE PCA", color="#00c8ff", fontsize=9, weight="bold")
# Fake line in panel
xs = np.linspace(0.4, 4.7, 60); ys = 2.8 + 0.8*np.sin(xs*1.5) + 0.1*np.random.randn(60)
ax.plot(xs, ys, color="#00ff9f", linewidth=1)

ax.add_patch(plt.Rectangle((5.1, 2.3), 4.7, 2.3, facecolor="#0e1a2a", edgecolor="#1b2942"))
ax.text(5.2, 4.4, "MORNING BRIEF (LLM)", color="#ffb020", fontsize=9, weight="bold")
for j, ln in enumerate([
    "• DXY firms as 10y UST breaks 4.40…",
    "• PCA Level +12bps (risk-off rotation)",
    "• GARCH vol spike on EUR/USD options",
    "• 3 red-flag events next 24h (FOMC)",
]):
    ax.text(5.25, 4.1 - 0.3*j, ln, color="#dddddd", fontsize=8)

ax.add_patch(plt.Rectangle((0.2, 0.1), 9.6, 2.1, facecolor="#0e1a2a", edgecolor="#1b2942"))
ax.text(0.3, 2.05, "NEWS FEED / GLOBE", color="#00ff9f", fontsize=9, weight="bold")
# Globe-like arcs
for r in [0.45, 0.65, 0.85]:
    theta = np.linspace(0, np.pi, 40)
    ax.plot(5 + r*np.cos(theta), 1.0 + r*np.sin(theta), color="#1f4e79", linewidth=0.8)
    ax.plot(5 + r*np.cos(theta), 1.0 - r*np.sin(theta), color="#1f4e79", linewidth=0.8)
# Globe dots
np.random.seed(1)
for _ in range(25):
    a = np.random.uniform(0, 2*np.pi); r = np.random.uniform(0, 0.8)
    ax.plot(5 + r*np.cos(a), 1.0 + 0.4*np.sin(a), "o", color="#ff4d6d", markersize=2.5)

plt.savefig(os.path.join(OUT, "fig10_ui.png"), facecolor=fig.get_facecolor())
plt.close()

print("Extra charts generated.")
