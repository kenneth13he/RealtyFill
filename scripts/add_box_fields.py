# scripts/add_box_fields.py
# Add fillable AcroForm text fields to a flat PDF whose blanks are drawn as
# filled BOXES rather than dot leaders.
#
# Why this exists alongside add_form_fields.py
# --------------------------------------------
# add_form_fields.py finds OREA's dot-leader blanks:
#     TENANT: ...................................................
# The RECO Information Guide doesn't use those. Its acknowledgement page draws
# each blank as a pale blue filled rectangle with the label printed *underneath*
# it. Running the dot-leader detector over it reports "No dot-leader blanks
# found", which is correct and useless.
#
# How it finds the blanks
# -----------------------
# Every filled rectangle in the page's drawing operations is a candidate. A
# real input box is wide, short, and not white or black — those bounds throw
# out rules, page furniture and background panels. The label is then the
# nearest text line starting just BELOW the box (RECO prints captions under
# the field, not beside it), which makes the generated names self-describing:
# p13_real_estate_agent_name, p13_buyer_seller_name_2.
#
# Like add_form_fields.py this refuses to touch a PDF that already has fields,
# and the positions it produces are INFERRED. Verify with --verify, which
# fills every box with its own field name and renders it back.
#
#   python scripts/add_box_fields.py in.pdf out.pdf
#   python scripts/add_box_fields.py in.pdf out.pdf --json schema.json
#   python scripts/add_box_fields.py in.pdf out.pdf --verify verify.pdf

import argparse
import json
import re
import sys
from collections import defaultdict

import pymupdf  # build-time only: detection. Not used by the fill pipeline.
from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject,
    BooleanObject,
    DictionaryObject,
    FloatObject,
    NameObject,
    NumberObject,
    TextStringObject,
)

# A real input box, by shape. Tuned on the RECO guide, where every box is
# 521x23 (full width) or 254x23 (half width).
MIN_WIDTH = 60.0
MIN_HEIGHT = 12.0
MAX_HEIGHT = 45.0

# White is the page; near-black is a rule or a solid panel. Neither is a blank.
def is_input_fill(fill) -> bool:
    if not fill or len(fill) < 3:
        return False
    r, g, b = fill[:3]
    if min(r, g, b) > 0.97:   # white-ish
        return False
    if max(r, g, b) < 0.25:   # black-ish
        return False
    return True


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")
    return slug[:48] or "field"


def find_boxes(page, page_number: int):
    """@returns [{name, page, rect}] for one page, ordered top-to-bottom, left-to-right."""
    height = page.rect.height

    labels = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            text = "".join(s["text"] for s in line["spans"]).strip()
            if text:
                labels.append({"text": text, "x": line["bbox"][0], "top": line["bbox"][1]})

    boxes = []
    for drawing in page.get_drawings():
        rect = drawing["rect"]
        if not is_input_fill(drawing.get("fill")):
            continue
        if rect.width < MIN_WIDTH or not (MIN_HEIGHT < rect.height < MAX_HEIGHT):
            continue
        boxes.append(rect)

    # Drawing order is arbitrary; reading order is not.
    boxes.sort(key=lambda r: (round(r.y0, 1), round(r.x0, 1)))

    used = set()
    fields = []
    counts = defaultdict(int)
    for rect in boxes:
        # The caption sits under the box and starts at the same left edge.
        candidates = [
            l for l in labels
            if 0 <= l["top"] - rect.y1 < 20 and abs(l["x"] - rect.x0) < 30
        ]
        label = min(candidates, key=lambda l: l["top"] - rect.y1)["text"] if candidates else ""

        base = f"p{page_number}_{slugify(label)}"
        counts[base] += 1
        name = base if counts[base] == 1 else f"{base}_{counts[base]}"
        if name in used:
            continue
        used.add(name)

        fields.append({
            "field_id": name,
            "page": page_number,
            "label": label,
            # AcroForm /Rect is bottom-left origin; PyMuPDF is top-left.
            # Inset slightly so typed text doesn't sit on the box edge.
            "rect": [
                round(rect.x0 + 2, 2),
                round(height - rect.y1 + 2, 2),
                round(rect.x1 - 2, 2),
                round(height - rect.y0 - 2, 2),
            ],
        })
    return fields


def add_fields(input_pdf: str, output_pdf: str, verify: bool = False):
    reader = PdfReader(input_pdf)
    if reader.get_fields():
        sys.exit(f"{input_pdf} already has AcroForm fields — refusing to overwrite them.")

    doc = pymupdf.open(input_pdf)
    all_fields = []
    for i, page in enumerate(doc, start=1):
        all_fields.extend(find_boxes(page, i))
    doc.close()

    if not all_fields:
        sys.exit(f"No box-style blanks found in {input_pdf}.")

    writer = PdfWriter(clone_from=reader)
    annots_by_page = defaultdict(list)

    for field in all_fields:
        widget = DictionaryObject()
        widget.update({
            NameObject("/Type"): NameObject("/Annot"),
            NameObject("/Subtype"): NameObject("/Widget"),
            NameObject("/FT"): NameObject("/Tx"),
            NameObject("/T"): TextStringObject(field["field_id"]),
            NameObject("/V"): TextStringObject(field["field_id"] if verify else ""),
            NameObject("/Ff"): NumberObject(0),
            NameObject("/DA"): TextStringObject("/Helv 10 Tf 0 g"),
            NameObject("/Rect"): ArrayObject([FloatObject(v) for v in field["rect"]]),
            NameObject("/F"): NumberObject(4),
        })
        ref = writer._add_object(widget)
        page_obj = writer.pages[field["page"] - 1]
        widget[NameObject("/P")] = page_obj.indirect_reference
        annots_by_page[field["page"] - 1].append(ref)

    for index, refs in annots_by_page.items():
        page_obj = writer.pages[index]
        existing = page_obj.get("/Annots")
        page_obj[NameObject("/Annots")] = ArrayObject(list(existing or []) + refs)

    acro = DictionaryObject()
    acro.update({
        NameObject("/Fields"): ArrayObject([r for refs in annots_by_page.values() for r in refs]),
        NameObject("/DR"): DictionaryObject(),
        NameObject("/NeedAppearances"): BooleanObject(True),
    })
    writer._root_object[NameObject("/AcroForm")] = writer._add_object(acro)
    writer.set_need_appearances_writer(True)

    with open(output_pdf, "wb") as f:
        writer.write(f)

    return all_fields


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("input_pdf")
    ap.add_argument("output_pdf")
    ap.add_argument("--json", help="write the detected field list here")
    ap.add_argument("--verify", action="store_true", help="prefill each box with its own field name")
    args = ap.parse_args()

    fields = add_fields(args.input_pdf, args.output_pdf, verify=args.verify)
    print(f"Added {len(fields)} field(s) to {args.output_pdf}")
    for f in fields:
        print(f"  {f['field_id']:44} page {f['page']}  rect {f['rect']}")

    if args.json:
        with open(args.json, "w", encoding="utf-8") as fh:
            json.dump(
                [{"field_id": f["field_id"], "type": "text", "page": f["page"], "rect": f["rect"]} for f in fields],
                fh, indent=2,
            )
        print(f"Wrote {args.json}")


if __name__ == "__main__":
    main()
