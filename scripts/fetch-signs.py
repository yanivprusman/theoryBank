#!/usr/bin/env python3
"""Regenerate mobile/app/src/main/assets/{signs.json,signs/} from the Ministry of
Transport's official sign table (לוח התמרורים, consolidated September 2022),
published as a PDF on gov.il.

The table is a four-column grid, right to left: the sign's picture, its number,
its meaning (פירושו) and where it applies (כוחו יפה). The PDF has no text layer
for the pictures and no structure beyond ruled lines, so the grid is read off the
rendered page:
  - each page's column edges come from its header labels "1." .. "4.";
  - a horizontal rule across the number column closes one sign's row;
  - a rule that also crosses the meaning column closes a group of signs that
    share one meaning (e.g. 102/103: "sharp bend right or left, respectively").
The picture is cropped from the sign's row; the text is read with pdftotext
cropped to the cell, which keeps Hebrew in logical order.

Needs poppler-utils (pdftoppm, pdftotext) and Pillow.
"""
import html, json, os, re, subprocess, sys, tempfile, urllib.request
from PIL import Image, ImageChops

WIKI_URL = ("https://he.wikipedia.org/w/api.php?action=parse&format=json&prop=wikitext&page="
            "%D7%AA%D7%9E%D7%A8%D7%95%D7%A8%D7%99%D7%9D_%D7%91%D7%99%D7%A9%D7%A8%D7%90%D7%9C")
# Slips in the published table, each checked against the PDF page and against
# Hebrew Wikipedia's transcription of the same sign: (sign, as printed, corrected).
TYPOS = [
    ("137", "להודעה זו;.", "להודעה זו."),
]
PDF_URL = ("https://www.gov.il/BlobFolder/policy/tamrurim_7924_01_18/he/"
           "1694327856_%D7%9C%D7%95%D7%AA_%D7%9D_%D7%9E%D7%A9%D7%95%D7%9C%D7%91_0922.pdf")
ASSETS = os.path.join(os.path.dirname(__file__), "..", "mobile", "app", "src", "main", "assets")
DPI = 200
K = DPI / 72  # pixels per PDF point

# Part headings as the table names them, by the first digit of the sign number.
PARTS = {
    "1": "אזהרה והתראה", "2": "הוריה", "3": "זכות קדימה", "4": "איסורים והגבלות",
    "5": "תחבורה ציבורית", "6": "מודיעין והדרכה", "7": "רמזורים ובקרת נתיבים",
    "8": "סימון על פני הדרך", "9": "אתר עבודה"
}
NUMBER = re.compile(r"^(\d{3})(פ?)$|^(פ)(\d{3})$")


HEB = re.compile("[\u05d0-\u05ea]")


def logical(word):
    """pdftotext's bbox words are in visual order: a Hebrew word's letters run
    left to right. Reverse Hebrew runs, keep digit/Latin runs as they are."""
    if not HEB.search(word):
        return word
    runs = re.findall(r"[0-9A-Za-z.]+|[^0-9A-Za-z.]+", word)
    return "".join(r if re.match(r"[0-9A-Za-z]", r) else r[::-1] for r in reversed(runs))


def cell_text(ws, x0, y0, x1, y1):
    """The text of one table cell, rebuilt from word boxes: lines top to bottom,
    words right to left. (pdftotext's own layout text scrambles numbers inside
    Hebrew: "( )1", "505 או, 506".)"""
    inside = [w for w in ws if x0 <= (w[0] + w[2]) / 2 <= x1 and y0 <= (w[1] + w[3]) / 2 <= y1]
    lines = []
    for w in sorted(inside, key=lambda w: w[1]):
        if lines and abs(lines[-1][0][1] - w[1]) < 3:
            lines[-1].append(w)
        else:
            lines.append([w])
    out = []
    for line in lines:
        text, prev = "", None
        for w in sorted(line, key=lambda w: -w[2]):
            glue = prev is not None and prev[0] - w[2] < 1.0  # touching boxes: one token
            text += ("" if prev is None or glue else " ") + logical(w[4])
            prev = w
        out.append(text)
    text = " ".join(out)
    # Brackets are mirrored glyphs in RTL text: visually ")1(" reads as "(1)".
    text = text.translate(str.maketrans("()", ")("))
    text = re.sub(r"\s+([,.;:])", r"\1", text)
    text = re.sub(r"(?<=[\u05d0-\u05ea])- (?=\d)", "-", text)  # "כ- 300" -> "כ-300"
    return re.sub(r"\s+", " ", text).strip()


def words(pdf, page):
    page_html = subprocess.run(["pdftotext", "-q", "-bbox", "-f", str(page), "-l", str(page), pdf, "-"],
                          capture_output=True, text=True, check=True).stdout
    return [(float(a), float(b), float(c), float(d), html.unescape(w)) for a, b, c, d, w in re.findall(
        r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>', page_html)]


def rules(img, x0, x1):
    """y (points) of horizontal lines that cross [x0, x1] almost entirely."""
    px, a, b = img.load(), int(x0 * K), int(x1 * K)
    ys, last = [], -10
    for y in range(img.height):
        # A table's closing rule is a hairline that can straddle two pixel rows.
        dark = sum(min(px[x, y], px[x, min(y + 1, img.height - 1)]) < 200 for x in range(a, b))
        if dark > 0.6 * (b - a):  # some rules are drawn broken
            if y - last > 3:
                ys.append(y / K)
            last = y
    return ys


def crop_sign(img, x0, y0, x1, y1):
    box = img.crop((int(x0 * K), int(y0 * K) + 4, int(x1 * K), int(y1 * K) - 3))
    bbox = ImageChops.invert(box.convert("L")).point(lambda v: 255 if v > 40 else 0).getbbox()
    if not bbox:
        return None
    pad = 6
    return box.crop((max(0, bbox[0] - pad), max(0, bbox[1] - pad),
                     min(box.width, bbox[2] + pad), min(box.height, bbox[3] + pad)))


def parse_page(pdf, page, img_path):
    ws = words(pdf, page)
    header = {w[4]: w for w in ws if w[1] < 80 and w[4] in "1234"}
    if not {"1", "2", "3"} <= set(header):
        return []  # a part's title page, not a table page
    # Header labels are right-aligned to their column. Road markings (part 8) have
    # no fourth column: their meaning runs to the table's left edge.
    right = {c: header[c][2] for c in header}
    img = Image.open(img_path).convert("RGB")
    gray = img.convert("L")
    # The header's top rule runs the full table width.
    hy = min(w[1] for w in header.values())
    top_rule = next((y for y in range(int((hy + 8) * K), 0, -1)
                    if sum(gray.getpixel((x, y)) < 200 for x in range(gray.width)) > gray.width / 3), None)
    if top_rule is None:
        return []  # numbered text on an introductory page, not a table
    dark = [x for y in range(top_rule - 2, top_rule + 3) for x in range(gray.width) if gray.getpixel((x, y)) < 200]
    table_left, table_right = min(dark) / K, max(dark) / K
    has_scope = "4" in right
    # The symbols appendix heads its picture column "צורת הסמל" (pdftotext's bbox
    # words come out letter-reversed) and numbers its rows "ס-1" .. "ס-141".
    # The symbols appendix (ס-1 .. ס-141) is left out: its entries are pictograms
    # used inside guidance signs, not signs, and the exam barely asks about them.
    # Its picture column is headed "צורת הסמל" (bbox words are letter-reversed).
    if any(w[4] == "למס" and w[1] < 90 for w in ws):
        return []
    right.setdefault("4", table_left)
    num_x0, num_x1 = right["3"] + 4, right["2"] + 6
    mean_x0, mean_x1 = right["4"] + 4, right["3"] + 4
    top = max(w[3] for w in header.values()) + 2
    # Every page ends with a footer: its page number, then "לוח תמרורים ..." (bbox
    # words are letter-reversed, so "חול"). The page number sits in the number
    # column on some pages, so nothing at or below it is part of the table.
    footer = min((w[1] for w in ws if w[4] == "חול" and w[1] > gray.height / K * 0.7), default=gray.height / K)
    bottom = footer - 20
    ws = [w for w in ws if w[1] < bottom]
    row_rules = [y for y in rules(gray, num_x0 + 2, num_x1 - 2) if top - 30 < y < bottom]
    group_rules = set(y for y in rules(gray, mean_x0 + 10, mean_x1 - 10) if y > top - 30)
    if len(row_rules) < 2:
        return []


    out, group = [], None
    for y0, y1 in zip(row_rules, row_rules[1:]):
        if any(abs(y0 - g) < 1.5 for g in group_rules) or group is None:
            y1g = y1_group(y0, row_rules, group_rules)
            group = {"t": cell_text(ws, mean_x0, y0, mean_x1, y1g),
                     "w": cell_text(ws, table_left, y0, mean_x0, y1g) if has_scope else ""}
        nums = [w for w in ws if num_x0 <= (w[0] + w[2]) / 2 <= num_x1 and y0 < w[1] < y1 and NUMBER.match(w[4])]
        # A bold number can spill past its column; start the picture right of it.
        pic_x0 = max([num_x1] + [w[2] + 2 for w in nums])
        pic = crop_sign(img, pic_x0, y0, table_right, y1)
        if not nums:
            if pic is not None and out:
                out[-1]["extra"].append(pic)  # a second picture of the sign above (e.g. 231)
            continue
        m = NUMBER.match(nums[0][4])
        number = (m.group(1) + m.group(2)) if m.group(1) else (m.group(4) + m.group(3))
        # "127פ" is set as two words: the digits and a separate פ beside them.
        beside = {w[4] for w in ws if abs(w[1] - nums[0][1]) < 2 and num_x0 <= (w[0] + w[2]) / 2 <= num_x1}
        if "פ" in beside:
            number = number.rstrip("פ") + "פ"
        out.append({"n": number, "t": group["t"], "w": group["w"], "pic": pic, "extra": [], "page": page})
    return out


def y1_group(y0, row_rules, group_rules):
    later = [y for y in row_rules if y > y0 + 1.5]
    for y in later:
        if any(abs(y - g) < 1.5 for g in group_rules):
            return y
    return later[-1] if later else y0


def stack(pics):
    w = max(p.width for p in pics)
    h = sum(p.height for p in pics) + 12 * (len(pics) - 1)
    out, y = Image.new("RGB", (w, h), "white"), 0
    for p in pics:
        out.paste(p, ((w - p.width) // 2, y))
        y += p.height + 12
    return out


def plain_wording():
    """Hebrew Wikipedia's per-sign wording ("תמרור 102 - עקומה חדה ימינה.").
    Used only where the official table gives several signs ONE meaning ending in
    "בהתאמה" (respectively), so each sign can say which half is its own. The
    official text stays alongside it as the law."""
    req = urllib.request.Request(WIKI_URL, headers={"User-Agent": "theoryBank/1.0 (fetch-signs.py)"})
    text = json.load(urllib.request.urlopen(req, timeout=60))["parse"]["wikitext"]["*"]
    out = {}
    for n, caption in re.findall(r"\|תמרור (\d{3}פ?)(?: \([^)]*\))? - ([^\n|]+)", text):
        out.setdefault(n, caption.strip())
    return out


def main():
    pdf = sys.argv[1] if len(sys.argv) > 1 else None
    tmp = tempfile.mkdtemp(prefix="signs-")
    if not pdf:
        pdf = os.path.join(tmp, "luach.pdf")
        req = urllib.request.Request(PDF_URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120) as r, open(pdf, "wb") as f:
            f.write(r.read())
    subprocess.run(["pdftoppm", "-q", "-r", str(DPI), "-png", pdf, os.path.join(tmp, "p")], check=True)
    pages = sorted(f for f in os.listdir(tmp) if f.startswith("p-") and f.endswith(".png"))

    signs = []
    for f in pages:
        page = int(re.search(r"(\d+)", f).group(1))
        signs += parse_page(pdf, page, os.path.join(tmp, f))

    dest = os.path.join(ASSETS, "signs")
    os.makedirs(dest, exist_ok=True)
    for old in os.listdir(dest):
        os.remove(os.path.join(dest, old))
    wiki = plain_wording()
    out, seen, problems = [], set(), []
    for s in signs:
        if s["n"] in seen:
            raise SystemExit(f"sign {s['n']} appears twice (page {s['page']})")
        seen.add(s["n"])
        pics = [p for p in [s["pic"], *s["extra"]] if p is not None]
        if not pics and not s["t"]:
            print(f"skipped {s['n']} (page {s['page']}): empty row, a number the table leaves unused")
            continue
        if not pics or not s["t"]:
            problems.append(f"{s['n']} (page {s['page']}): " + ("no picture" if not pics else "no meaning"))
            continue
        for n, printed, corrected in TYPOS:
            if s["n"] == n:
                if printed not in s["t"]:
                    raise SystemExit(f"sign {n}: typo {printed!r} no longer in the table, drop it from TYPOS")
                s["t"] = s["t"].replace(printed, corrected)
        pic = stack(pics)
        pic.thumbnail((300, 300))
        name = f"{s['n']}.png"
        # Signs are a handful of flat colours; a palette keeps the APK small.
        pic.quantize(64, dither=Image.Dither.NONE).save(os.path.join(dest, name), optimize=True)
        item = {"n": s["n"], "p": PARTS[s["n"][0]], "t": s["t"], "w": s["w"], "i": name}
        out.append(item)
    # Only rows the table shares between signs ("... ימינה או שמאלה, בהתאמה").
    shared = {t for t in (x["t"] for x in out) if sum(y["t"] == t for y in out) > 1}
    for item in out:
        if item["t"] in shared and "בהתאמה" in item["t"] and item["n"] in wiki:
            item["s"] = wiki[item["n"]]
    with open(os.path.join(ASSETS, "signs.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(out)} signs")
    if problems:
        raise SystemExit("left out, needs a decision:\n  " + "\n  ".join(problems))


if __name__ == "__main__":
    main()
