#!/usr/bin/env python3
"""Regenerate mobile/app/src/main/assets/{questions.json,img/} from the official
Ministry of Transport theory bank (data.gov.il dataset "tqhe", datastore API).

Each question keeps its four options in the official order plus the index of
the correct one (the one gov.il highlights in yellow). A few
records in the official data carry a broken <img src>; their real URLs are
listed in IMAGE_OVERRIDES (found by probing gov.il, verified by eye).
"""
import html, json, os, re, subprocess, concurrent.futures as cf, urllib.request

RESOURCE = "bf7cb748-f220-474b-a4d5-2d59f93db28d"
API = f"https://data.gov.il/api/3/action/datastore_search?resource_id={RESOURCE}&limit=5000"
PIC = "https://www.gov.il/BlobFolder/generalpage/{}/he/TQ_PIC_{}.jpg"
IMAGE_OVERRIDES = {
    120: PIC.format("tq_pic_01", "3120"),
    483: PIC.format("tq_pic_01", "3483"),
    574: PIC.format("tq_pic_02", "3574"),
    907: PIC.format("tq_pic_02", "3907"),
}
ASSETS = os.path.join(os.path.dirname(__file__), "..", "mobile", "app", "src", "main", "assets")


def clean(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s))).strip()


def main():
    records = json.load(urllib.request.urlopen(API, timeout=120))["result"]["records"]
    out, images = [], {}
    for r in records:
        m = re.match(r"\s*(\d+)\.\s*(.*)", r["title2"], re.S)
        n, d = int(m.group(1)), r["description4"]
        spans = re.findall(r"<li><span( id=\"correctAnswer\d+\")?>(.*?)</span></li>", d, re.S)
        correct = [k for k, (marked, _) in enumerate(spans) if marked]
        if len(spans) != 4 or len(correct) != 1:
            raise SystemExit(f"question {n}: expected 4 options with one correct, got {len(spans)}/{len(correct)}")
        item = {"n": n, "q": clean(m.group(2)), "o": [clean(t) for _, t in spans], "k": correct[0],
                "c": r["category"],
                # the source mixes a Cyrillic "В" in for licence B
                "l": [x.replace("В", "B") for x in re.findall(r"«(\w+)»", d)]}
        if "<img" in d:
            url = IMAGE_OVERRIDES.get(n) or re.search(r'<img src="([^"]+)"', d).group(1)
            if not url.startswith("https://"):
                raise SystemExit(f"question {n}: broken image src {url!r} — add it to IMAGE_OVERRIDES")
            item["i"] = f"{n}.jpg"
            images[item["i"]] = url
        out.append(item)
    out.sort(key=lambda x: x["n"])

    os.makedirs(os.path.join(ASSETS, "img"), exist_ok=True)

    def fetch(kv):
        name, url = kv
        dest = os.path.join(ASSETS, "img", name)
        subprocess.run(["curl", "-sfL", "--retry", "3", "--max-time", "60", "-A", "Mozilla/5.0",
                        "-o", dest, url], check=True)

    with cf.ThreadPoolExecutor(12) as ex:
        list(ex.map(fetch, images.items()))
    with open(os.path.join(ASSETS, "questions.json"), "w") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(out)} questions, {len(images)} pictures")


if __name__ == "__main__":
    main()
