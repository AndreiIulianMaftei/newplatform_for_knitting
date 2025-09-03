#!/usr/bin/env python3
"""
Scrape knittingfool.com stitch tables into individual CSV files.

Each StitchID gets its own CSV inside the output folder.
"""

import os
import csv
import time
import random
import argparse
import re
from typing import List, Dict, Optional

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.knittingfool.com/StitchIndex/StitchDetail.aspx?StitchID={id}"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; knit-scraper/1.0; +https://example.com/contact)"
}


def safe_filename(name: str) -> str:
    """Make a string safe for filenames."""
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", name).strip("_") or "unknown"


def fetch_html(url: str, session: requests.Session, max_retries: int = 4, timeout: int = 20) -> Optional[str]:
    backoff = 1.0
    for attempt in range(max_retries):
        try:
            resp = session.get(url, headers=HEADERS, timeout=timeout)
            if resp.status_code == 200 and resp.text:
                return resp.text
        except requests.RequestException:
            pass
        time.sleep(backoff + random.uniform(0, 0.5))
        backoff *= 2
    return None


def parse_table_rows(soup: BeautifulSoup) -> List[Dict[str, str]]:
    results: List[Dict[str, str]] = []
    table = soup.find("table", id="ContentBody_GridView1")
    if not table:
        return results

    headers = [th.get_text(strip=True) for th in table.find_all("th")]
    if not headers:
        headers = ["Row #", "Side", "Begin Row", "Repeat", "Repeat From *", "End Row"]

    for tr in table.find_all("tr"):
        tds = tr.find_all("td")
        if not tds:
            continue
        values = [td.get_text(strip=True).replace("\xa0", "") for td in tds]
        while len(values) < len(headers):
            values.append("")
        row_dict = dict(zip(headers, values[:len(headers)]))
        results.append(row_dict)
    return results


def extract_text_input_value(soup: BeautifulSoup, input_id: str) -> str:
    el = soup.find("input", id=input_id)
    return el.get("value", "").strip() if el else ""


def scrape_stitch(stitch_id: int, session: requests.Session) -> Dict[str, any]:
    url = BASE_URL.format(id=stitch_id)
    html = fetch_html(url, session)
    if html is None:
        return {"ok": False, "rows": [], "meta": {"stitch_name": ""}, "error": "fetch_failed"}

    soup = BeautifulSoup(html, "html.parser")
    rows = parse_table_rows(soup)

    stitch_name = extract_text_input_value(soup, "ContentBody_StitchName")
    multiple_of = extract_text_input_value(soup, "ContentBody_NumberOfStitches")
    stitches_plus = extract_text_input_value(soup, "ContentBody_StitchesPlus")

    return {
        "ok": bool(rows),
        "rows": rows,
        "meta": {
            "stitch_id": stitch_id,
            "stitch_name": stitch_name,
            "multiple_of": multiple_of,
            "stitches_plus": stitches_plus,
            "url": url
        },
        "error": "" if rows else "no_table"
    }


def save_table_to_csv(data: Dict[str, any], outdir: str):
    stitch_id = data["meta"]["stitch_id"]
    name = safe_filename(data["meta"].get("stitch_name", f"stitch_{stitch_id}"))
    filename = os.path.join(outdir, f"{stitch_id}_{name}.csv")

    if not data["rows"]:
        # Write empty placeholder CSV with metadata
        with open(filename, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["No data", data.get("error", "")])
        return filename

    headers = list(data["rows"][0].keys())
    # Add metadata columns at the beginning
    extra_cols = ["StitchID", "StitchName", "MultipleOf", "StitchesPlus", "SourceURL"]
    all_headers = extra_cols + headers

    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=all_headers)
        writer.writeheader()
        for row in data["rows"]:
            writer.writerow({
                "StitchID": stitch_id,
                "StitchName": data["meta"].get("stitch_name", ""),
                "MultipleOf": data["meta"].get("multiple_of", ""),
                "StitchesPlus": data["meta"].get("stitches_plus", ""),
                "SourceURL": data["meta"].get("url", ""),
                **row
            })

    return filename


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", type=int, default=1, help="Starting StitchID (inclusive)")
    ap.add_argument("--end", type=int, default=2000, help="Ending StitchID (inclusive)")
    ap.add_argument("--outdir", type=str, default="stitches", help="Output folder")
    ap.add_argument("--delay", type=float, default=1.0, help="Delay (seconds) between requests")
    args = ap.parse_args()

    os.makedirs(args.outdir, exist_ok=True)

    with requests.Session() as session:
        for sid in range(args.start, args.end + 1):
            data = scrape_stitch(sid, session)
            if data["ok"]:
                print(f"[OK] {sid:4d} → {data['meta']['stitch_name']}")
            else:
                print(f"[--] {sid:4d} → {data.get('error')}")

            filepath = save_table_to_csv(data, args.outdir)
            print(f"    Saved: {filepath}")

            time.sleep(max(0, args.delay) + random.uniform(0, 0.3))

    print(f"Done! All CSVs saved inside: {args.outdir}")


if __name__ == "__main__":
    main()
