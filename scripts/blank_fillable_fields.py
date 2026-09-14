# scripts/blank_fillable_fields.py
# Clears every fillable field's value from a filled AcroForm PDF, producing a
# true blank template. Unlike check_fillable_fields.py's cousin approach of
# relying on extract_form_field_info.py's single recorded page per field, this
# scans every page's own /Annots directly so a field that appears as a widget
# on more than one page (e.g. a name repeated near a signature block) gets
# cleared everywhere it appears, not just its "canonical" page.
#
# Usage: python3 blank_fillable_fields.py [input pdf] [output pdf]
#
# Used to produce forms/blank_templates/*_blank.pdf from the real filled PDFs
# in Desktop/Realme FIles — verify the output with `strings out.pdf | grep`
# for known PII before treating it as safe to commit.

import sys
from pypdf import PdfReader, PdfWriter

def get_full_id(annotation):
    components = []
    while annotation:
        field_name = annotation.get('/T')
        if field_name:
            components.append(field_name)
        annotation = annotation.get('/Parent')
    return ".".join(reversed(components)) if components else None

def blank_pdf(input_path, output_path):
    reader = PdfReader(input_path)
    writer = PdfWriter(clone_from=reader)

    # Build per-page dict by scanning EVERY page's actual annotations,
    # so fields that share a name across multiple pages/widgets get cleared everywhere.
    for page_index, page in enumerate(writer.pages):
        annots = page.get('/Annots', [])
        page_values = {}
        for ann in annots:
            obj = ann.get_object()
            ft = obj.get('/FT') or (obj.get('/Parent') and obj.get('/Parent').get_object().get('/FT'))
            field_id = get_full_id(obj)
            if not field_id:
                continue
            if ft == '/Tx':
                page_values[field_id] = ""
            elif ft == '/Btn':
                # checkbox/radio: set to Off
                page_values[field_id] = "/Off"
        if page_values:
            try:
                writer.update_page_form_field_values(page, page_values, auto_regenerate=False)
            except Exception as e:
                print(f"warn page {page_index+1}: {e}")

    writer.set_need_appearances_writer(True)
    with open(output_path, "wb") as fh:
        writer.write(fh)

if __name__ == "__main__":
    blank_pdf(sys.argv[1], sys.argv[2])
