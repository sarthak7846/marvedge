FROM node:20-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg fonts-roboto fonts-liberation fonts-noto fonts-dejavu fonts-freefont-ttf \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .

# Bundle the default watermark badge into the image (like the fonts under
# fonts/, this lands via COPY . . above; the explicit COPY keeps it in the image
# even if a .dockerignore is later added). It is Logo.png as-is — the solid blue
# Marvedge badge — resolved by render.js at /app/assets/marvedge-watermark.png.
COPY assets ./assets

ENV NODE_ENV=production
ENV PORT=8080

CMD ["npm", "start"]
