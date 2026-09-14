# Dockerfile
# RealtyFill needs both Node (Next.js) and Python (lib/pdfFill.ts shells out
# to scripts/fill_fillable_fields.py, which uses pypdf) at runtime — this is
# exactly the constraint TESTING_READINESS.md flags as ruling out Vercel's
# default serverless functions. A single Docker image with both runtimes
# works on Render, Railway, Fly.io, or a plain VM without further code
# changes to lib/pdfFill.ts's own Python-candidate probing.

FROM node:20-slim

# python3-pip on Debian bookworm+ marks the system Python as "externally
# managed" (PEP 668) and refuses a bare `pip install`. This container is
# single-purpose and disposable, so --break-system-packages is the
# pragmatic choice here rather than adding a venv for one package.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY requirements.txt ./
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
