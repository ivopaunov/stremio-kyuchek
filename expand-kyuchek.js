const fs = require("fs/promises");
const yaml = require("js-yaml");

const INPUT_PATH = "./kyuchek.yaml";
const OUTPUT_PATH = "./kyuchek.expanded.yaml";
const REQUEST_TIMEOUT_MS = 10000;
const REQUEST_MIN_INTERVAL_MS = 350;
const RETRY_ATTEMPTS = 4;
const RETRY_BASE_DELAY_MS = 800;
const SEARCH_QUERY_LIMIT = 8;
const SEARCH_CANDIDATE_LIMIT = 25;
const CHANCE_CATEGORY = "шанс";
const CATEGORY_SONG_TARGET = 10;
const NAME_DAYS_CATEGORY = "имен ден";
const BIRTHDAYS_CATEGORY = "рожден ден";
let lastRequestTs = 0;

// Top popular Bulgarian names that celebrate name days (30 male + 30 female)
const BULGARIAN_NAMES = {
  male: [
    { name: "Георги", query: "Георги кючек" },
    { name: "Димитър", query: "Димитър кючек" },
    { name: "Иван", query: "Иван кючек" },
    { name: "Николай", query: "Николай кючек" },
    { name: "Петър", query: "Петър кючек" },
    { name: "Христо", query: "Христо кючек" },
    { name: "Александър", query: "Александър кючек" },
    { name: "Стефан", query: "Стефан кючек" },
    { name: "Йордан", query: "Йордан кючек" },
    { name: "Тодор", query: "Тодор кючек" },
    { name: "Васил", query: "Васил кючек" },
    { name: "Атанас", query: "Атанас кючек" },
    { name: "Борис", query: "Борис кючек" },
    { name: "Калоян", query: "Калоян кючек" },
    { name: "Красимир", query: "Красимир кючек" },
    { name: "Любомир", query: "Любомир кючек" },
    { name: "Мартин", query: "Мартин кючек" },
    { name: "Даниел", query: "Даниел кючек" },
    { name: "Виктор", query: "Виктор кючек" },
    { name: "Пламен", query: "Пламен кючек" },
    { name: "Илия", query: "Илия кючек" },
    { name: "Ангел", query: "Ангел кючек" },
    { name: "Камен", query: "Камен кючек" },
    { name: "Павел", query: "Павел кючек" },
    { name: "Емил", query: "Емил кючек" },
    { name: "Румен", query: "Румен кючек" },
    { name: "Теодор", query: "Теодор кючек" },
    { name: "Валентин", query: "Валентин кючек" },
    { name: "Костадин", query: "Костадин кючек" },
    { name: "Добромир", query: "Добромир кючек" },
  ],
  female: [
    { name: "Мария", query: "Мария кючек" },
    { name: "Елена", query: "Елена кючек" },
    { name: "Иванка", query: "Иванка кючек" },
    { name: "Йорданка", query: "Йорданка кючек" },
    { name: "Гергана", query: "Гергана кючек" },
    { name: "Десислава", query: "Десислава кючек" },
    { name: "Теодора", query: "Теодора кючек" },
    { name: "Петя", query: "Петя кючек" },
    { name: "Антония", query: "Антония кючек" },
    { name: "Виктория", query: "Виктория кючек" },
    { name: "Габриела", query: "Габриела кючек" },
    { name: "Никол", query: "Никол кючек" },
    { name: "Стефка", query: "Стефка кючек" },
    { name: "Румяна", query: "Румяна кючек" },
    { name: "Виолета", query: "Виолета кючек" },
    { name: "Цветелина", query: "Цветелина кючек" },
    { name: "Цветана", query: "Цветана кючек" },
    { name: "Росица", query: "Росица кючек" },
    { name: "Радка", query: "Радка кючек" },
    { name: "Зорница", query: "Зорница кючек" },
    { name: "Лилия", query: "Лилия кючек" },
    { name: "Надежда", query: "Надежда кючек" },
    { name: "Любов", query: "Любов кючек" },
    { name: "Вяра", query: "Вяра кючек" },
    { name: "Надя", query: "Надя кючек" },
    { name: "Татяна", query: "Татяна кючек" },
    { name: "Даниела", query: "Даниела кючек" },
    { name: "Силвия", query: "Силвия кючек" },
    { name: "Милена", query: "Милена кючек" },
    { name: "Кристина", query: "Кристина кючек" },
  ],
};

const CATEGORY_SEARCH_KEYWORDS = {
  болести: ["болест кючек", "болница кючек", "ваксина кючек", "корона кючек"],
  "за душата": [
    "за душата кючек",
    "любов кючек",
    "чувство кючек",
    "сърце кючек",
  ],
  "pop culture": [
    "поп култура кючек",
    "кино кючек",
    "сериал кючек",
    "герои кючек",
  ],
  "pop folk": ["поп фолк кючек", "чалга кючек", "народна музика кючек"],
  бедствия: ["беда кючек", "катастрофа кючек", "опасност кючек"],
  бесни: ["бесен кючек", "луд кючек", "адреналин кючек", "буря кючек"],
  мода: ["тоалет кючек", "облекло кючек", "мода кючек"],
  работа: ["работа кючек", "работник кючек", "труд кючек", "бизнес кючек"],
  разгонени: ["разгонен кючек", "палав кючек", "закачка кючек", "флирт кючек"],
  спорт: ["спорт кючек", "стадион кючек", "отбор кючек", "футбол кючек"],
  животни: ["животно кючек", "куче кючек", "котка кючек", "кон кючек"],
  храна: ["храна кючек", "ядене кючек", "готвене кючек", "мезе кючек"],
  мазно: ["мазно кючек", "горещ кючек", "купон кючек", "алкохол кючек"],
  коли: ["кола кючек", "машина кючек", "автомобил кючек", "шофиране кючек"],
  "коли и жени": ["коли и жени кючек", "момиче кючек", "жена кючек"],
  "експериМЕНТАЛ кючек": ["експериментален кючек", "нетипичен кючек"],
  талант: ["талант кючек", "артист кючек", "певец кючек"],
  "класическа музика": [
    "класическа музика кючек",
    "традиционен кючек",
    "ретро кючек",
  ],
  далавера: ["далаверка кючек", "хитрост кючек", "измама кючек"],
  "сен тропe": [
    "сен тропе кючек",
    "saint tropez manele",
    "σεν τροπέ τσιφτετέλι",
    "sen tropez turbofolk",
    "saint tropez tallava",
    "saint tropez cajke",
    "sen tropez oryantal",
    "sen trope čoček",
  ],
  молитва: ["молитва кючек", "вяра кючек", "религия кючек"],
  wanderlust: ["пътешествие кючек", "почивка кючек", "море кючек"],
  мебели: ["мебели кючек", "дом кючек", "диван кючек"],
  "рождени дни": [
    "рожден ден кючек",
    "честит рожден ден кючек",
    "парти кючек",
    "торта кючек",
  ],
};

async function main() {
  console.log("📝 Expanding kyuchek.yaml with new songs...\n");

  const inputContent = await fs.readFile(INPUT_PATH, "utf8");
  const doc = yaml.load(inputContent);

  if (!doc.catalog || !doc.catalog.items) {
    console.error("❌ Invalid YAML structure");
    process.exit(1);
  }

  const existingCategories = Object.keys(doc.catalog.items).filter(
    (category) =>
      category !== CHANCE_CATEGORY &&
      category !== NAME_DAYS_CATEGORY &&
      category !== BIRTHDAYS_CATEGORY,
  );

  // Global URL deduplication — prevents any URL appearing twice across all new categories.
  const globalSeenUrls = new Set();

  console.log(
    `🔍 Building "${CHANCE_CATEGORY}" with ${CATEGORY_SONG_TARGET} songs per category...`,
  );
  const chanceSongs = [];
  for (const category of existingCategories) {
    const keywords = (
      CATEGORY_SEARCH_KEYWORDS[category] || [`${category} кючек`]
    ).slice(0, SEARCH_QUERY_LIMIT);
    const songs = await findNewSongs(
      keywords,
      CATEGORY_SONG_TARGET,
      globalSeenUrls,
    );
    chanceSongs.push(...songs);
    console.log(`  ✅ ${category}: ${songs.length}`);

    // Slow down per category to reduce YouTube throttling.
    await sleep(500 + Math.floor(Math.random() * 700));
  }
  doc.catalog.items[CHANCE_CATEGORY] = chanceSongs;

  console.log(`\n📛 Building "${NAME_DAYS_CATEGORY}" (1 song per name)...`);
  const allNames = [...BULGARIAN_NAMES.male, ...BULGARIAN_NAMES.female];
  const nameDaySongs = [];
  let nameFound = 0;
  for (const entry of allNames) {
    process.stdout.write(
      `\r  Processing: ${entry.name}...                    `,
    );
    const result = await findNameDaySong(entry.name, globalSeenUrls);
    if (result) {
      nameDaySongs.push(result);
      nameFound++;
    }
  }
  console.log(`\n  ✅ Added ${nameFound}/${allNames.length} names`);
  doc.catalog.items[NAME_DAYS_CATEGORY] = nameDaySongs;

  console.log(`\n🎂 Building "${BIRTHDAYS_CATEGORY}"...`);
  const birthdayQueries = [
    "рожден ден кючек",
    "честит рожден ден кючек",
    "birthday kuchek",
    "happy birthday manele",
    "парти кючек",
  ];
  const birthdaySongs = await findNewSongs(birthdayQueries, 20, globalSeenUrls);
  doc.catalog.items[BIRTHDAYS_CATEGORY] = birthdaySongs;
  console.log(`  ✅ Added ${birthdaySongs.length} songs`);

  // Serialize back to YAML with custom formatting
  const output = serializeYamlWithFormatting(doc);
  await fs.writeFile(OUTPUT_PATH, output);

  console.log(`\n✅ Expanded kyuchek saved to: ${OUTPUT_PATH}`);
  console.log(`\n📝 Now validating expanded catalog...`);

  // Validate
  const validatePath = "./validate-videos.js";
  const { spawn } = require("child_process");
  const validatedPath = "./kyuchek.expanded.valid.yaml";

  const validate = spawn("node", [validatePath, OUTPUT_PATH, validatedPath]);

  validate.stdout.on("data", (data) => {
    process.stdout.write(data);
  });

  validate.stderr.on("data", (data) => {
    process.stderr.write(data);
  });

  validate.on("close", (code) => {
    if (code === 0) {
      console.log("\n✅ Validation complete!");
      console.log(`📁 Validated songs: ${validatedPath}`);
    } else {
      console.error(`\n❌ Validation failed with code ${code}`);
      process.exit(1);
    }
  });
}

function serializeYamlWithFormatting(doc) {
  let output = "addon:\n";
  output += `  name: ${doc.addon.name}\n`;
  output += `  description: ${doc.addon.description}\n`;
  output += `  version: "${doc.addon.version}"\n\n`;
  output += "catalog:\n";
  output += `  type: ${doc.catalog.type}\n`;
  output += "  items:\n";

  for (const [category, items] of Object.entries(doc.catalog.items)) {
    output += `    ${category}:\n`;
    for (const item of items) {
      if (typeof item === "string") {
        if (item.startsWith("#")) {
          output += `      ${item}\n`;
        } else if (item.startsWith("- ") || item.startsWith("thumb:")) {
          output += `      ${item}\n`;
        } else if (item.startsWith("http")) {
          output += `      - ${item}\n`;
        } else {
          output += `      - ${item}\n`;
        }
      } else if (item && typeof item === "object") {
        // Preserve original YAML mapping entries like:
        // - Артист - Песен: https://youtube...
        const entries = Object.entries(item);
        if (!entries.length) continue;

        for (const [key, value] of entries) {
          if (value === undefined || value === null) continue;
          if (key === "thumb") {
            output += `      - thumb: ${String(value)}\n`;
          } else {
            output += `      - ${key}: ${String(value)}\n`;
          }
        }
      }
    }
  }

  return output;
}

async function findNewSongs(queries, limit, globalSeenUrls = new Set()) {
  const allCandidates = [];
  const seenCandidateUrls = new Set();
  const seenKeys = new Set();
  const candidatePoolTarget = Math.max(limit * 8, 40);

  for (const query of queries) {
    const candidates = await searchYouTubeCandidates(query);
    for (const candidate of candidates) {
      if (
        !seenCandidateUrls.has(candidate.url) &&
        !globalSeenUrls.has(candidate.url)
      ) {
        seenCandidateUrls.add(candidate.url);
        allCandidates.push(candidate);
        if (allCandidates.length >= candidatePoolTarget) break;
      }
    }
    if (allCandidates.length >= candidatePoolTarget) break;
  }

  // Iterate ALL candidates (not just first `limit`) to find enough valid results.
  const results = [];
  for (const candidate of allCandidates) {
    const meta = await fetchVideoMetadata(candidate.id);
    if (!meta) continue;
    if (!isLikelySong(meta.title)) continue;

    const entryKey = formatArtistTitle(meta.artist, meta.title);
    if (!entryKey) continue;
    if (seenKeys.has(entryKey) || globalSeenUrls.has(candidate.url)) continue;

    seenKeys.add(entryKey);
    globalSeenUrls.add(candidate.url);
    results.push({ [entryKey]: candidate.url });
    if (results.length >= limit) break;
  }
  return results;
}

// For name days: less strict — skips isLikelySong so any music result counts.
async function findNameDaySong(name, globalSeenUrls) {
  const queries = [`${name} кючек`, `имен ден ${name} кючек`];
  for (const query of queries) {
    const candidates = await searchYouTubeCandidates(query);
    for (const candidate of candidates) {
      if (globalSeenUrls.has(candidate.url)) continue;
      const meta = await fetchVideoMetadata(candidate.id);
      if (!meta) continue;
      const entryKey = formatArtistTitle(meta.artist, meta.title);
      if (!entryKey) continue;
      globalSeenUrls.add(candidate.url);
      return { [`имен ден - ${name}`]: candidate.url };
    }
  }
  return null;
}

function cleanPart(text) {
  return String(text)
    .replace(/@/g, "") // strip @ channel mentions
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[|/\\:]+/g, " ")
    .replace(/\s*-\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatArtistTitle(rawArtist, rawTitle) {
  if (!rawArtist || !rawTitle) return null;

  const artist = cleanPart(rawArtist);
  const title = cleanPart(rawTitle);
  if (!artist || !title) return null;
  if (artist.toLowerCase() === "unknown") return null;

  // Exactly one separator between artist and title.
  return `${artist} - ${title}`;
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
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    const artist = parts[0];
    const songTitle = parts.slice(1).join(" ");
    if (artist && songTitle) {
      return { artist, title: songTitle };
    }
  }

  return { artist: author, title };
}

function isLikelySong(title) {
  if (!title) return false;
  const t = String(title).toLowerCase();

  const negative = [
    "podcast",
    "епизод",
    "episode",
    "новини",
    "news",
    "интервю",
    "interview",
    "реакция",
    "reaction",
    "vlog",
    "стрийм",
    "stream",
    "tutorial",
    "урок",
    "кастинг",
  ];
  if (negative.some((w) => t.includes(w))) return false;

  const positive = [
    "кючек",
    "kuchek",
    "kyuchek",
    "manele",
    "tallava",
    "чалга",
    "song",
    "песен",
    "mix",
    "remix",
    "official",
    "орк",
    "band",
    "live",
    "feat",
    " ft",
  ];
  return positive.some((w) => t.includes(w));
}

async function fetchVideoMetadata(videoId) {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
  try {
    const response = await fetchWithRetry(endpoint, `oembed:${videoId}`);
    if (response.ok) {
      const data = await response.json();
      if (!data.title || !data.author_name) return null;
      return splitArtistAndTitle(data.title, data.author_name);
    }

    if ([401, 403, 429].includes(response.status)) {
      console.error(
        `  ⚠️  oEmbed throttled/rejected (${response.status}) for ${videoId}, using watch fallback`,
      );
      return await fetchVideoMetadataFromWatchPage(videoId);
    }

    return null;
  } catch {
    return await fetchVideoMetadataFromWatchPage(videoId);
  }
}

async function fetchVideoMetadataFromWatchPage(videoId) {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

  try {
    const response = await fetchWithRetry(watchUrl, `watch:${videoId}`);
    if (!response.ok) return null;

    const html = await response.text();
    const title = extractWatchTitle(html);
    const author = extractWatchAuthor(html);
    if (!title || !author) return null;

    return splitArtistAndTitle(title, author);
  } catch {
    return null;
  }
}

function extractWatchTitle(html) {
  const titleMatch = html.match(/<title>(.*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    const clean = decodeHtmlEntities(titleMatch[1])
      .replace(/\s*-\s*YouTube\s*$/i, "")
      .trim();
    if (clean) return clean;
  }

  const jsonMatch = html.match(
    /"title"\s*:\s*\{\s*"runs"\s*:\s*\[\s*\{\s*"text"\s*:\s*"([^"]+)"/,
  );
  if (jsonMatch && jsonMatch[1]) {
    return decodeJsonEscapes(jsonMatch[1]).trim();
  }

  return null;
}

function extractWatchAuthor(html) {
  const ownerMatch = html.match(/"ownerChannelName"\s*:\s*"([^"]+)"/);
  if (ownerMatch && ownerMatch[1]) {
    return decodeJsonEscapes(ownerMatch[1]).trim();
  }

  const channelMatch = html.match(/"channelName"\s*:\s*"([^"]+)"/);
  if (channelMatch && channelMatch[1]) {
    return decodeJsonEscapes(channelMatch[1]).trim();
  }

  return null;
}

function decodeHtmlEntities(str) {
  return String(str)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}

function decodeJsonEscapes(str) {
  return String(str)
    .replace(/\\u0026/g, "&")
    .replace(/\\u003d/g, "=")
    .replace(/\\u002F/g, "/")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, " ")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ");
}

async function searchYouTubeCandidates(query) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

  try {
    const response = await fetchWithRetry(url, `search:${query}`);
    if (!response.ok) {
      console.error(
        `  ⚠️  Search failed for "${query}" (HTTP ${response.status})`,
      );
      return [];
    }

    const html = await response.text();
    const ids = extractVideoIdsFromSearchHtml(html).slice(
      0,
      SEARCH_CANDIDATE_LIMIT,
    );
    return ids.map((id) => ({
      id,
      url: `https://www.youtube.com/watch?v=${id}`,
    }));
  } catch (err) {
    console.error(`  ⚠️  Search error for "${query}": ${err.message}`);
    return [];
  }
}

function extractVideoIdsFromSearchHtml(html) {
  // Exclude Shorts
  const shortsIds = new Set();
  for (const m of html.match(/\/shorts\/([A-Za-z0-9_-]{11})/g) || []) {
    const id = m.slice(8);
    if (isValidVideoId(id)) shortsIds.add(id);
  }

  const matches = html.match(/"videoId":"([A-Za-z0-9_-]{11})"/g) || [];
  const unique = new Set();

  for (const m of matches) {
    const id = m.slice(11, 22);
    if (isValidVideoId(id) && !shortsIds.has(id)) unique.add(id);
  }

  return [...unique];
}

function isValidVideoId(id) {
  return typeof id === "string" && /^[A-Za-z0-9_-]{11}$/.test(id);
}

async function fetchWithTimeout(url) {
  const now = Date.now();
  const waitMs = Math.max(0, REQUEST_MIN_INTERVAL_MS - (now - lastRequestTs));
  if (waitMs > 0) await sleep(waitMs);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "bg-BG,bg;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });
    lastRequestTs = Date.now();
    clearTimeout(timeout);
    return response;
  } catch (err) {
    lastRequestTs = Date.now();
    clearTimeout(timeout);
    throw err;
  }
}

async function fetchWithRetry(url, label) {
  let lastError = null;

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const response = await fetchWithTimeout(url);
      if (!shouldRetryStatus(response.status) || attempt === RETRY_ATTEMPTS) {
        return response;
      }

      const delay =
        RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) +
        Math.floor(Math.random() * 400);
      console.error(
        `  ⚠️  Retry ${attempt}/${RETRY_ATTEMPTS} for ${label} (HTTP ${response.status}), waiting ${delay}ms`,
      );
      await sleep(delay);
    } catch (err) {
      lastError = err;
      if (attempt === RETRY_ATTEMPTS) break;
      const delay =
        RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) +
        Math.floor(Math.random() * 400);
      console.error(
        `  ⚠️  Retry ${attempt}/${RETRY_ATTEMPTS} for ${label} (${err.message}), waiting ${delay}ms`,
      );
      await sleep(delay);
    }
  }

  throw lastError || new Error(`Failed after retries: ${label}`);
}

function shouldRetryStatus(status) {
  return status === 403 || status === 429 || status >= 500;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
