const fs = require("fs/promises");

const REQUEST_TIMEOUT_MS = 10000;
const SEARCH_CANDIDATE_LIMIT = 5;

async function testYouTubeSearch() {
  console.log("🧪 Testing YouTube search with one query...\n");

  const query = "болест кющек";
  console.log(`Searching for: "${query}"`);

  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    console.log(`URL: ${url}\n`);

    const response = await fetchWithTimeout(url);
    console.log(`Response status: ${response.status}`);

    if (!response.ok) {
      console.error(`❌ HTTP error: ${response.status}`);
      return;
    }

    const html = await response.text();
    console.log(`HTML length: ${html.length} bytes\n`);

    const ids = extractVideoIdsFromSearchHtml(html).slice(
      0,
      SEARCH_CANDIDATE_LIMIT,
    );

    if (ids.length === 0) {
      console.log("❌ No video IDs found");
      return;
    }

    console.log(`✅ Found ${ids.length} video IDs:\n`);
    ids.forEach((id, i) => {
      const url = `https://www.youtube.com/watch?v=${id}`;
      console.log(`${i + 1}. ${url}`);
    });
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
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

testYouTubeSearch();
