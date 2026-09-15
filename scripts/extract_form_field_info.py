# CLI wrapper around ../pdf-service/extract_form_field_info.py.
#
# Same arrangement, and same reason, as scripts/fill_fillable_fields.py: the
# one copy of this logic lives in pdf-service/ because that directory is
# deployed as its own Vercel root and cannot import from outside itself.
# See that file's header for the full explanation.

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pdf-service"))

from extract_form_field_info import (  # noqa: E402
    get_field_info,
    write_field_info,
)

__all__ = ["get_field_info", "write_field_info"]


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: extract_form_field_info.py [input pdf] [output json]")
        sys.exit(1)
    write_field_info(sys.argv[1], sys.argv[2])
