import * as cheerio from "cheerio";

function compactText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function extractDate(text) {
  const match = compactText(text).match(/(\d{4}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}[./-]\d{1,2})/);
  return match ? match[1] : "";
}

function normalizeUrl(href, baseUrl) {
  if (!href) return baseUrl;
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return baseUrl;
  }
}

export async function crawlPublicNotices({ url, selector = "a", limit = 20 }) {
  if (!url) {
    const error = new Error("크롤링할 공개 URL이 필요합니다.");
    error.status = 400;
    error.code = "MISSING_URL";
    throw error;
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent": "CampusLens demo crawler (+http://localhost)"
    }
  });

  if (!response.ok) {
    const error = new Error(`공개 페이지 요청 실패: ${response.status} ${response.statusText}`);
    error.status = 502;
    error.code = "CRAWL_REQUEST_FAILED";
    throw error;
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const crawledAt = new Date().toISOString();
  const seen = new Set();
  const items = [];

  $(selector).each((index, element) => {
    if (items.length >= limit) return false;

    const $element = $(element);
    const title = compactText($element.text());
    if (title.length < 4) return undefined;

    const href = $element.attr("href");
    const sourceUrl = normalizeUrl(href, url);
    const containerText = compactText($element.closest("li, tr, article, section, div").text());
    const key = `${title}::${sourceUrl}`;

    if (seen.has(key)) return undefined;
    seen.add(key);

    items.push({
      title,
      sourceUrl,
      dateText: extractDate(containerText || title),
      text: (containerText || title).slice(0, 700),
      crawledAt
    });

    return undefined;
  });

  return items;
}
