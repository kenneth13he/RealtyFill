# pdf-service/main.py
# Vercel Service (see /vercel.json's `services.pdf-service`) — the PDF-fill
# pipeline as an internal HTTP endpoint instead of a local subprocess, for
# the Vercel deployment path where lib/pdfFill.ts can't just execFile a
# local Python interpreter the way it does in `npm run dev` or on the
# Render/Docker path (see Dockerfile). Not publicly routable — see
# vercel.json's rewrites, which only expose the "frontend" service; the
# Next.js app reaches this one via the PDF_SERVICE_URL binding.

import base64
import hmac
import logging
import os

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

from fill_fillable_fields import FillValidationError, fill_pdf_bytes

app = FastAPI()
log = logging.getLogger("uvicorn.error")

# Shared secret with the Next.js app (lib/pdfFill.ts sends it as
# X-PDF-Service-Secret). Until this existed, /fill accepted any base64 PDF
# from any caller and the only thing keeping it private was vercel.json
# routing just the "frontend" service publicly — one routing change away from
# a public endpoint running pypdf over attacker-supplied files.
#
# Deliberately NOT fail-closed when unset: making the secret mandatory would
# break PDF generation the moment this deploys ahead of the environment
# variable being configured. Unset means "behave exactly as before, and say
# so loudly in the logs"; set means enforce. Configure PDF_SERVICE_SECRET on
# both services to turn the check on.
_SECRET = os.environ.get("PDF_SERVICE_SECRET") or None

if _SECRET is None:
    log.warning(
        "PDF_SERVICE_SECRET is not set — /fill is accepting unauthenticated "
        "requests. Set it on this service and on the Next.js app to enable "
        "the check."
    )


def _require_caller_secret(provided: str | None) -> None:
    """Reject a caller that can't prove it's our own app.

    No-op when no secret is configured — see the note above.
    """
    if _SECRET is None:
        return
    # compare_digest, not ==, so a wrong guess can't be narrowed down by
    # timing how long the comparison took.
    if provided is None or not hmac.compare_digest(provided, _SECRET):
        raise HTTPException(status_code=401, detail="Unauthorized")


class FieldValue(BaseModel):
    field_id: str
    page: int
    value: str


class FillRequest(BaseModel):
    blank_pdf_base64: str
    fields: list[FieldValue]


class FillResponse(BaseModel):
    filled_pdf_base64: str


@app.post("/fill", response_model=FillResponse)
def fill(req: FillRequest, x_pdf_service_secret: str | None = Header(default=None)):
    _require_caller_secret(x_pdf_service_secret)
    pdf_bytes = base64.b64decode(req.blank_pdf_base64)
    try:
        filled_bytes = fill_pdf_bytes(pdf_bytes, [f.model_dump() for f in req.fields])
    except FillValidationError as e:
        raise HTTPException(status_code=422, detail=e.errors)
    return FillResponse(filled_pdf_base64=base64.b64encode(filled_bytes).decode("ascii"))


@app.get("/health")
def health():
    return {"ok": True}
