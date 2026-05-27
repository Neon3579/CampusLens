/**
 * File: server/services/crawler.js
 * Purpose: 공개 학교 웹페이지에서 공지 후보 링크를 수집하고 기본 메타데이터를 추출한다.
 * Notes: 크롤링 대상은 공개 URL만 전제로 하며, LLM 정규화 전의 raw-notices 데이터를 만든다.
 */

import * as cheerio from "cheerio";

/**
 * compactText
 * HTML에서 추출한 텍스트의 연속 공백을 하나로 줄이고 앞뒤 공백을 제거한다.
 *
 * @param {string} value - 정리할 텍스트
 * @returns {string} 압축된 텍스트
 */
function compactText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

/**
 * extractDate
 * 텍스트 안에서 공지 날짜로 보이는 숫자 패턴을 찾아 반환한다.
 *
 * @param {string} text - 날짜 후보가 포함된 텍스트
 * @returns {string} 발견된 날짜 문자열 또는 빈 문자열
 */
function extractDate(text) {
  const match = compactText(text).match(/(\d{4}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}[./-]\d{1,2})/);
  return match ? match[1] : "";
}

/**
 * normalizeUrl
 * 상대 링크를 기준 URL에 맞춰 절대 URL로 변환한다.
 *
 * @param {string} href - 링크 href 값
 * @param {string} baseUrl - 기준 페이지 URL
 * @returns {string} 절대 URL
 */
function normalizeUrl(href, baseUrl) {
  if (!href) return baseUrl;
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return baseUrl;
  }
}

/**
 * crawlPublicNotices
 * 지정 URL에서 selector에 맞는 요소를 순회해 공지 후보 배열을 수집한다.
 *
 * @param {object} options - 크롤링 옵션
 * @param {string} options.url - 공개 공지 페이지 URL
 * @param {string} options.selector - 공지 링크를 찾을 CSS selector
 * @param {number} options.limit - 최대 수집 개수
 * @returns {Promise<Array<object>>} raw notice 후보 배열
 */
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
