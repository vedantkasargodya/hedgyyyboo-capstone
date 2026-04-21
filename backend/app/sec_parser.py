"""
Hedgyyyboo -- Live SEC EDGAR filing parser.

Pulls REAL 10-K/10-Q filings from SEC EDGAR and extracts key sections
(Risk Factors, MD&A).  NO dummy data.
"""

from __future__ import annotations

import logging
import re
import time
from typing import Any

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SEC_BASE = "https://data.sec.gov"
SEC_HEADERS = {
    "User-Agent": "Hedgyyyboo Research research@hedgyyyboo.com",
    "Accept-Encoding": "gzip, deflate",
}
_RATE_LIMIT = 0.15  # SEC: max 10 req/s


def _sec_get(url: str) -> requests.Response:
    """Rate-limited GET from SEC EDGAR."""
    time.sleep(_RATE_LIMIT)
    resp = requests.get(url, headers=SEC_HEADERS, timeout=30)
    resp.raise_for_status()
    return resp


def _get_cik(ticker: str) -> str | None:
    """Resolve a ticker symbol to a zero-padded CIK."""
    try:
        url = "https://www.sec.gov/files/company_tickers.json"
        resp = _sec_get(url)
        data = resp.json()
        ticker_upper = ticker.upper()
        for entry in data.values():
            if entry.get("ticker", "").upper() == ticker_upper:
                return str(entry["cik_str"]).zfill(10)
        return None
    except Exception as exc:
        logger.error("CIK lookup failed for %s: %s", ticker, exc)
        return None


def get_company_filings(
    ticker: str,
    filing_type: str = "10-K",
    count: int = 2,
) -> list[dict[str, Any]]:
    """Fetch recent filing metadata from SEC EDGAR.

    Returns list of dicts with accession_number, filing_date, primary_doc URL.
    """
    cik = _get_cik(ticker)
    if not cik:
        raise ValueError(f"Could not find CIK for ticker '{ticker}'")

    submissions_url = f"{SEC_BASE}/submissions/CIK{cik}.json"
    resp = _sec_get(submissions_url)
    data = resp.json()

    recent = data.get("filings", {}).get("recent", {})
    forms = recent.get("form", [])
    dates = recent.get("filingDate", [])
    accessions = recent.get("accessionNumber", [])
    primary_docs = recent.get("primaryDocument", [])

    filings: list[dict[str, Any]] = []
    for i, form in enumerate(forms):
        if form == filing_type and len(filings) < count:
            acc_no = accessions[i].replace("-", "")
            doc_url = f"https://www.sec.gov/Archives/edgar/data/{cik.lstrip('0')}/{acc_no}/{primary_docs[i]}"
            filings.append({
                "accession_number": accessions[i],
                "filing_date": dates[i],
                "filing_url": doc_url,
                "form_type": form,
            })

    if not filings:
        raise ValueError(f"No {filing_type} filings found for {ticker}")

    logger.info("Found %d %s filings for %s", len(filings), filing_type, ticker)
    return filings


def download_filing_html(filing_url: str) -> str:
    """Download the raw HTML of a filing document."""
    resp = _sec_get(filing_url)
    return resp.text


def extract_risk_factors(html_content: str) -> str:
    """Extract 'Item 1A: Risk Factors' section from a 10-K/10-Q HTML filing."""
    soup = BeautifulSoup(html_content, "lxml")
    text = soup.get_text(separator="\n")

    patterns_start = [
        r"(?i)item\s*1a[\.\:\s]*risk\s*factors",
        r"(?i)ITEM\s*1A",
    ]
    patterns_end = [
        r"(?i)item\s*1b",
        r"(?i)item\s*2[\.\:\s]",
        r"(?i)ITEM\s*1B",
        r"(?i)ITEM\s*2\b",
    ]

    start_idx = None
    for pat in patterns_start:
        match = re.search(pat, text)
        if match:
            start_idx = match.start()
            break

    if start_idx is None:
        logger.warning("Could not find Item 1A in filing")
        return extract_mda(html_content)

    end_idx = len(text)
    search_after = start_idx + 100
    for pat in patterns_end:
        match = re.search(pat, text[search_after:])
        if match:
            end_idx = search_after + match.start()
            break

    section = text[start_idx:end_idx].strip()
    section = re.sub(r"\n{3,}", "\n\n", section)
    section = re.sub(r"[ \t]+", " ", section)

    if len(section) < 200:
        logger.warning("Item 1A section too short (%d chars), trying MD&A", len(section))
        return extract_mda(html_content)

    max_chars = 100_000
    if len(section) > max_chars:
        section = section[:max_chars]

    return section


def extract_mda(html_content: str) -> str:
    """Extract Item 7: Management's Discussion and Analysis."""
    soup = BeautifulSoup(html_content, "lxml")
    text = soup.get_text(separator="\n")

    patterns_start = [
        r"(?i)item\s*7[\.\:\s]*management",
        r"(?i)ITEM\s*7\b",
    ]
    patterns_end = [
        r"(?i)item\s*7a",
        r"(?i)item\s*8[\.\:\s]",
        r"(?i)ITEM\s*7A",
        r"(?i)ITEM\s*8\b",
    ]

    start_idx = None
    for pat in patterns_start:
        match = re.search(pat, text)
        if match:
            start_idx = match.start()
            break

    if start_idx is None:
        return "Could not extract Item 7 (MD&A) from filing."

    end_idx = len(text)
    search_after = start_idx + 100
    for pat in patterns_end:
        match = re.search(pat, text[search_after:])
        if match:
            end_idx = search_after + match.start()
            break

    section = text[start_idx:end_idx].strip()
    section = re.sub(r"\n{3,}", "\n\n", section)
    section = re.sub(r"[ \t]+", " ", section)

    max_chars = 100_000
    if len(section) > max_chars:
        section = section[:max_chars]

    return section


def chunk_text(
    text: str,
    chunk_size: int = 512,
    overlap: int = 50,
) -> list[str]:
    """Split text into overlapping chunks at sentence boundaries."""
    sentences = re.split(r"(?<=[.!?])\s+", text)
    chunks: list[str] = []
    current_chunk: list[str] = []
    current_len = 0

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue

        if current_len + len(sentence) > chunk_size and current_chunk:
            chunks.append(" ".join(current_chunk))
            overlap_text = " ".join(current_chunk)
            if len(overlap_text) > overlap:
                words = overlap_text.split()
                keep = max(1, len(words) // 4)
                current_chunk = words[-keep:]
                current_len = sum(len(w) + 1 for w in current_chunk)
            else:
                current_chunk = []
                current_len = 0

        current_chunk.append(sentence)
        current_len += len(sentence) + 1

    if current_chunk:
        chunks.append(" ".join(current_chunk))

    return [c for c in chunks if len(c.strip()) > 20]
