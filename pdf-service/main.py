# pdf-service/main.py
# Vercel Service (see /vercel.json's `services.pdf-service`) — the PDF-fill
# pipeline as an internal HTTP endpoint instead of a local subprocess, for
# the Vercel deployment path where lib/pdfFill.ts can't just execFile a
# local Python interpreter the way it does in `npm run dev` or on the
# Render/Docker path (see Dockerfile). Not publicly routable — see
# vercel.json's rewrites, which only expose the "frontend" service; the
# Next.js app reaches this one via the PDF_SERVICE_URL binding.

import base64

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from fill_fillable_fields import FillValidationError, fill_pdf_bytes

app = FastAPI()


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
def fill(req: FillRequest):
    pdf_bytes = base64.b64decode(req.blank_pdf_base64)
    try:
        filled_bytes = fill_pdf_bytes(pdf_bytes, [f.model_dump() for f in req.fields])
    except FillValidationError as e:
        raise HTTPException(status_code=422, detail=e.errors)
    return FillResponse(filled_pdf_base64=base64.b64encode(filled_bytes).decode("ascii"))


@app.get("/health")
def health():
    return {"ok": True}
