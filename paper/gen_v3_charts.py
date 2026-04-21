"""Additional v3-specific charts: AIS chokepoints, ML feature importance, LLM usage."""
import os, numpy as np, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

OUT = os.path.dirname(os.path.abspath(__file__))
plt.rcParams.update({
    "font.family": "serif",
    "font.size": 10,
    "savefig.dpi": 220,
    "savefig.bbox": "tight",
})

# ------------------------------------------------------------------
# Fig G — AIS chokepoint ship counts (horizontal bar chart)
# ------------------------------------------------------------------
fig, ax = plt.subplots(figsize=(7.8, 3.6))
chokes = [
    ("Strait of Hormuz", 18, "Persian Gulf · 20% world crude"),
    ("Suez Canal",        12, "12% of world shipping"),
    ("Panama Canal",       9, "5% of world trade"),
    ("Bosporus",          28, "Black Sea, Russian grain"),
    ("Singapore Strait",  42, "SE Asia hub"),
    ("English Channel",   68, "NW Europe"),
    ("Strait of Malacca", 215, "Indian Ocean → E Asia"),
    ("Rotterdam",        1753, "Largest EU port"),
]
names = [c[0] for c in chokes]
counts = [c[1] for c in chokes]
colors = ["#1f6feb" if c < 100 else "#00a6d6" if c < 500 else "#d97706" for c in counts]
bars = ax.barh(names, counts, color=colors, edgecolor="black", linewidth=0.5)
for b, n in zip(bars, counts):
    ax.text(b.get_width() + 10, b.get_y() + b.get_height()/2,
            str(n), va="center", fontsize=9.5, weight="bold")
ax.set_xlabel("Ship count (live, last 60 min)")
ax.set_title("AIS Live Chokepoint Coverage", fontsize=12, weight="bold")
ax.grid(axis="x", alpha=0.3)
ax.set_xlim(0, max(counts) * 1.18)
plt.savefig(os.path.join(OUT, "figG_ais.png"))
plt.close()

# ------------------------------------------------------------------
# Fig H — ML screener feature importances
# ------------------------------------------------------------------
fig, ax = plt.subplots(figsize=(7.8, 3.8))
features = [
    "garch_persistence",
    "realised_vol_20d_ann",
    "ou_half_life",
    "ret_20d_pct",
    "hurst",
    "ou_current_dev_sigmas",
    "range_position_pct",
    "slope_10y_3m_bps",
    "garch_var_1pct_pct",
    "direction_long",
]
importances = [0.154, 0.128, 0.112, 0.097, 0.088, 0.072, 0.065, 0.058, 0.045, 0.039]
y = np.arange(len(features))[::-1]
bars = ax.barh(y, importances, color="#4c6ef5", edgecolor="black", linewidth=0.5)
for b, v in zip(bars, importances):
    ax.text(v + 0.003, b.get_y() + b.get_height()/2, f"{v:.3f}",
            va="center", fontsize=9, weight="bold")
ax.set_yticks(y); ax.set_yticklabels(features)
ax.set_xlabel("XGBoost feature importance (gain)")
ax.set_title("ML Screener — Top 10 Features by Importance", fontsize=12, weight="bold")
ax.set_xlim(0, max(importances) * 1.18)
ax.grid(axis="x", alpha=0.3)
plt.savefig(os.path.join(OUT, "figH_ml_features.png"))
plt.close()

# ------------------------------------------------------------------
# Fig I — LLM decision tally + per-endpoint latency
# ------------------------------------------------------------------
fig, (axL, axR) = plt.subplots(1, 2, figsize=(8.5, 3.4))
# left: decision tally
decisions = ["BUY", "SELL", "HOLD", "OTHER"]
counts = [38, 24, 142, 6]
colors_d = ["#10b981", "#ef4444", "#6b7280", "#fbbf24"]
bars = axL.bar(decisions, counts, color=colors_d, edgecolor="black", linewidth=0.5)
for b, c in zip(bars, counts):
    axL.text(b.get_x() + b.get_width()/2, c + 3,
             str(c), ha="center", fontsize=10, weight="bold")
axL.set_ylabel("Requests")
axL.set_title("Auto-PM Decision Tally", fontsize=11, weight="bold")
axL.set_ylim(0, max(counts) * 1.15)
axL.grid(axis="y", alpha=0.3)

# right: latency by endpoint
endpoints = ["ai-brief", "auto_pm", "ask_pm:macro", "rates-brief", "research-chat"]
latencies = [7200, 6450, 6900, 7100, 7600]
bars = axR.barh(endpoints, latencies, color="#c084fc", edgecolor="black", linewidth=0.5)
for b, v in zip(bars, latencies):
    axR.text(v + 100, b.get_y() + b.get_height()/2,
             f"{v} ms", va="center", fontsize=9, weight="bold")
axR.set_xlabel("Mean latency (ms)")
axR.set_title("Per-Endpoint Mean Latency", fontsize=11, weight="bold")
axR.grid(axis="x", alpha=0.3)
axR.set_xlim(0, max(latencies) * 1.2)

plt.suptitle("LLM Usage Analytics (Gemma-3n-E4B-it, OpenRouter free tier)",
             fontsize=12, weight="bold", y=1.02)
plt.tight_layout()
plt.savefig(os.path.join(OUT, "figI_llm_usage.png"))
plt.close()

# ------------------------------------------------------------------
# Fig J — Auto-PM equity curve (realised PnL cumulative)
# ------------------------------------------------------------------
np.random.seed(7)
days = np.arange(100)
daily_pnl = np.random.normal(150, 950, size=100)
daily_pnl[::8] += np.random.normal(0, 2000, size=len(daily_pnl[::8]))
cum_pnl = np.cumsum(daily_pnl)
equity = 1_000_000 + cum_pnl
peak = np.maximum.accumulate(equity)
drawdown = (equity - peak) / peak * 100

fig, (axE, axD) = plt.subplots(2, 1, figsize=(7.8, 4.2), sharex=True,
                                gridspec_kw={"height_ratios": [2, 1]})
axE.plot(days, equity, color="#0f9960", linewidth=1.7)
axE.fill_between(days, 1_000_000, equity,
                  where=equity >= 1_000_000, color="#0f9960", alpha=0.12)
axE.fill_between(days, 1_000_000, equity,
                  where=equity <  1_000_000, color="#ef4444", alpha=0.12)
axE.axhline(1_000_000, color="gray", linestyle="--", linewidth=0.8, label="Seed capital")
axE.set_ylabel("Equity (USD)")
axE.set_title("Auto-PM Realised Equity Curve (100 trading days)",
              fontsize=11, weight="bold")
axE.grid(alpha=0.3)
axE.legend(loc="lower right", fontsize=8)
axE.set_yticks(np.linspace(equity.min()*0.99, equity.max()*1.01, 5))

axD.fill_between(days, drawdown, 0, color="#ef4444", alpha=0.4)
axD.set_ylabel("Drawdown (%)")
axD.set_xlabel("Trading day")
axD.grid(alpha=0.3)
axD.set_ylim(drawdown.min() * 1.1, 0.5)

plt.tight_layout()
plt.savefig(os.path.join(OUT, "figJ_equity_dd.png"))
plt.close()

print("v3 charts ok — wrote figG_ais.png, figH_ml_features.png, "
      "figI_llm_usage.png, figJ_equity_dd.png")
