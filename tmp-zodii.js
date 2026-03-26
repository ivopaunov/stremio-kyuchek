const fs = require("fs/promises");

const SIGNS = [
  "Овен",
  "Телец",
  "Близнаци",
  "Рак",
  "Лъв",
  "Дева",
  "Везни",
  "Скорпион",
  "Стрелец",
  "Козирог",
  "Водолей",
  "Риби",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const RETRY_ATTEMPTS = 3;

function cleanPart(text) {
  return String(text)
    .replace(/@/g, "")
    .replace(/#/g, "")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[|/\\:]+/g, " ")
    .replace(/\s*-\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitArtistAndTitle(metaTitle, authorName) {
  const title = String(metaTitle || "")
    .replace(/\s+/g, " ")
    .trim();
  const author = String(authorName || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!title || !author) return null;

  const parts = title
    .split(" - ")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return {
      artist: parts[0],
      title: parts.slice(1).join(" "),
    };
  }

  return { artist: author, title };
}

function formatArtistTitle(metaTitle, authorName, sign) {
  const split = splitArtistAndTitle(metaTitle, authorName);
  if (!split) return null;

  const artist = cleanPart(split.artist);
  let title = cleanPart(split.title);
  if (!artist || !title) return null;

  const suffix = `(${sign})`;
  if (!title.includes(suffix)) {
    title = `${title} ${suffix}`;
  }

  return `${artist} - ${title}`;
}

function isLikelyMusic(metaTitle, authorName) {
  const title = String(metaTitle || "").toLowerCase();
  const author = String(authorName || "").toLowerCase();
  const combined = `${title} ${author}`;

  const positiveSignals = [
    "кючек",
    "kuchek",
    "kyuchek",
    "kiuchek",
    "manele",
    "tallava",
    "remix",
    "mix",
    "орк",
    "ork",
    "бенд",
    "band",
    "official",
    "audio",
    "live",
    "topic",
    "feat",
    " ft.",
    " ft ",
  ];

  const negativeSignals = [
    "хороскоп",
    "horoscope",
    "zodiac facts",
    "predictions",
    "прогноза",
    "астрология",
    "astrology",
    "life in the mirror",
    "животът в огледалото",
    "meditation",
    "affirmation",
    "утвърждения",
    "съвместимост",
  ];

  if (negativeSignals.some((signal) => combined.includes(signal))) {
    return false;
  }

  return positiveSignals.some((signal) => combined.includes(signal));
}

async function fetchMetadata(videoUrl, sign) {
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(endpoint, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept-Language": "bg-BG,bg;q=0.9,en-US;q=0.8,en;q=0.7",
        },
      });

      if (!response.ok) {
        await sleep(700 * attempt);
        continue;
      }

      const data = await response.json();
      const key = formatArtistTitle(data.title, data.author_name, sign);
      if (!key) return null;
      if (!isLikelyMusic(data.title, data.author_name)) return null;
      return { key, url: videoUrl };
    } catch {
      await sleep(700 * attempt);
    }
  }

  return null;
}

function extractIds(html) {
  const shortsIds = new Set();
  for (const m of html.match(/\/shorts\/([A-Za-z0-9_-]{11})/g) || []) {
    const id = m.slice(8);
    shortsIds.add(id);
  }

  const matches = html.match(/"videoId":"([A-Za-z0-9_-]{11})"/g) || [];
  const ids = [];
  const seen = new Set();

  for (const m of matches) {
    const id = m.slice(11, 22);
    if (seen.has(id) || shortsIds.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  return ids;
}

async function searchThree(sign, globalUsed, globalKeys) {
  const variants = [
    `${sign} кючек`,
    `зодия ${sign} кючек`,
    `${sign} орк кючек`,
    `${sign} бенд кючек`,
    `${sign} manele`,
    `${sign} kyuchek`,
    `${sign} kuchek`,
  ];

  const out = [];
  for (const query of variants) {
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
      const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
      let response;
      try {
        response = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept-Language": "bg-BG,bg;q=0.9,en-US;q=0.8,en;q=0.7",
          },
        });
      } catch {
        await sleep(1000 * attempt);
        continue;
      }

      if (!response.ok) {
        await sleep(1200 * attempt);
        continue;
      }

      const html = await response.text();
      const ids = extractIds(html);
      for (const id of ids) {
        const watchUrl = `https://www.youtube.com/watch?v=${id}`;
        if (globalUsed.has(watchUrl)) continue;
        const metadata = await fetchMetadata(watchUrl, sign);
        if (!metadata) continue;
        if (globalKeys.has(metadata.key)) continue;

        globalUsed.add(watchUrl);
        globalKeys.add(metadata.key);
        out.push(metadata);
        if (out.length === 3) return out;
      }

      if (out.length) break;
      await sleep(700 * attempt);
    }
    if (out.length === 3) return out;
  }

  return out;
}

async function main() {
  const used = new Set();
  const keys = new Set();
  let output = "    зодии:\n";

  for (const sign of SIGNS) {
    const urls = await searchThree(sign, used, keys);
    output += `      # ${sign}\n`;

    for (const item of urls) {
      output += `      - ${item.key}: ${item.url}\n`;
    }

    await sleep(1400);
  }

  await fs.writeFile("./zodii-snippet.yaml", output, "utf8");
  console.log("Generated zodii-snippet.yaml");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
