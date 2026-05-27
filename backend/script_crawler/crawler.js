import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

import { NOTICES_FILE, writeJson, ensureDir, PUBLIC_DIR } from "../services/fileStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.resolve(__dirname, "../ollama_config.json");

const LIST_URL = "https://www.kyonggi.ac.kr/u_computer/selectBbsNttList.do";
const BBS_KEY = "8824";
const BBS_NO = "1073";

function compact(value = "") {
	return String(value).replace(/\s+/g, " ").trim();
}

function buildListUrl(pageIndex = 1) {
	const url = new URL(LIST_URL);
	url.searchParams.set("key", BBS_KEY);
	url.searchParams.set("bbsNo", BBS_NO);
	url.searchParams.set("pageIndex", String(pageIndex));
	return url.href;
}

function buildDetailUrl(nttNo) {
	const url = new URL("https://www.kyonggi.ac.kr/u_computer/selectBbsNttView.do");
	url.searchParams.set("key", BBS_KEY);
	url.searchParams.set("bbsNo", BBS_NO);
	url.searchParams.set("nttNo", String(nttNo));
	return url.href;
}

async function fetchHtml(url) {
	const response = await fetch(url, {
		headers: { "User-Agent": "CampusLens demo crawler (+http://localhost)" },
	});
	if (!response.ok) {
		throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
	}
	return response.text();
}

function parseList(html) {
	const $ = cheerio.load(html);
	const rows = $("table.p-table.simple tbody tr");
	const items = [];
	rows.each((_, el) => {
		const $row = $(el);
		const tds = $row.find("td");
		if (tds.length < 7) return;

		const numEl = $(tds[0]).find(".bbs_num");
		const num = compact(numEl.length ? numEl.text() : $(tds[0]).text());
		const categoryRaw = compact($(tds[1]).text());
		const subjectLink = $(tds).find("td.p-subject a").first();
		const title = compact(subjectLink.text());
		const href = subjectLink.attr("href") || "";
		const dept = compact($(tds[4]).text());
		const views = compact($(tds[5]).text());
		const dateEl = $(tds[6]).find("time");
		const dateText = compact(dateEl.length ? dateEl.text() : $(tds[6]).text());

		const nttNo = extractNttNo(href);
		if (!nttNo || !title) return;

		items.push({
			nttNo,
			num,
			title,
			category: categoryRaw || "기타",
			dept: dept || "컴퓨터공학전공",
			views,
			date: normalizeDate(dateText),
			listUrl: href.startsWith("http") ? href : new URL(href, LIST_URL).href,
		});
	});
	return items;
}

function extractNttNo(href = "") {
	const match = String(href).match(/nttNo=(\d+)/);
	if (match) return match[1];
	const onclick = String(href).match(/\((['"])?(\d+)\1?/);
	return onclick ? onclick[2] : "";
}

function normalizeDate(text = "") {
	const match = String(text).match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
	if (!match) return text;
	return `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;
}

async function fetchDetail(nttNo) {
	const url = buildDetailUrl(nttNo);
	const html = await fetchHtml(url);
	const $ = cheerio.load(html);

	const title = compact($(".bbs_viewbox .subjectbox span").first().text());
	const fieldItems = $(".fieldlistbox .field_item")
		.map((_, el) => compact($(el).text()))
		.get();
	const author = fieldItems[0] || "";
	const writtenAt = fieldItems[1] || "";
	const content = compact($(".viewcontentbox .contenttext").text());
	const images = $(".bbs_photo img")
		.map((_, el) => $(el).attr("src") || "")
		.get()
		.filter(Boolean)
		.map((src) => (src.startsWith("http") ? src : new URL(src, url).href));
	const attachments = $(".attachedfile .attach_item")
		.map((_, el) => {
			const $el = $(el);
			const link = $el.find("a").first();
			const name = compact($el.text());
			const href = link.attr("href") || "";
			return {
				name,
				url: href ? (href.startsWith("http") ? href : new URL(href, url).href) : "",
			};
		})
		.get()
		.filter((a) => a.name);

	return { url, title, author, writtenAt, content, images, attachments };
}

function inferCategoryFallback(text = "") {
	const t = String(text);
	if (/(장학|학자금)/.test(t)) return "장학";
	if (/(취업|채용|인턴|모집)/.test(t)) return "취업";
	if (/(행사|대회|경진|공모|세미나|특강)/.test(t)) return "행사";
	if (/(학사|수강|이수|성적|등록|졸업|시험|강의평가|학적)/.test(t)) return "학사";
	return "기타";
}

function summarizeFallback(content = "", title = "") {
	const body = compact(content) || compact(title);
	if (!body) return title;
	const sentence = body.split(/[\.。!?\n]/).find((s) => s.trim().length > 5) || body;
	return sentence.length > 90 ? `${sentence.slice(0, 87)}...` : sentence;
}

function extractDeadlineFallback(content = "") {
	const m = String(content).match(/(\d{1,2})[.\-/](\d{1,2})\s*(?:까지|마감)/);
	if (m) return `${String(m[1]).padStart(2, "0")}.${String(m[2]).padStart(2, "0")}`;
	return "";
}

function looksUrgent(content = "", category = "") {
	if (category === "행사" || category === "취업") return /마감|임박|오늘|내일/.test(content);
	return /마감|필수|즉시|긴급|당일/.test(content);
}

function buildFallbackNotice(item, detail) {
	const text = [item.title, detail.content].filter(Boolean).join("\n");
	const category = inferCategoryFallback(text);
	return {
		id: `notice_${item.nttNo}`,
		nttNo: item.nttNo,
		title: detail.title || item.title,
		category: category,
		dept: item.dept || "컴퓨터공학전공",
		summary: summarizeFallback(detail.content, item.title),
		content: detail.content || "",
		deadline: extractDeadlineFallback(detail.content),
		date: item.date || "",
		url: detail.url,
		tags: [category, "공지"],
		urgent: looksUrgent(detail.content, category),
		attachments: detail.attachments || [],
	};
}

async function loadOllamaConfig() {
	try {
		const raw = await fs.readFile(CONFIG_PATH, "utf8");
		return JSON.parse(raw);
	} catch (e) {
		return null;
	}
}

async function normalizeWithOllama(rawItems, config) {
	if (!config || !config.url || !config.model) {
		throw new Error("Ollama 설정이 비어 있습니다.");
	}
	if (!rawItems.length) return [];

	const prompt = [
		"다음은 경기대학교 컴퓨터공학전공 게시판에서 크롤링한 공지 데이터입니다.",
		"각 항목을 CampusLens 앱이 쓰는 공지 객체로 정리해 반환하세요.",
		"규칙:",
		"- category 는 '학사', '장학', '취업', '행사', '기타' 중 하나",
		"- summary 는 한국어 한 문장으로 짧게",
		"- tags 는 1~5개의 짧은 한국어 키워드 배열",
		"- urgent 는 마감이 임박하거나 필수 안내면 true",
		"- attachments 는 입력 값을 그대로 유지",
		"- url, nttNo, date 는 입력 값을 그대로 유지",
		"",
		"JSON Schema:",
		JSON.stringify({
			type: "object",
			properties: {
				notices: {
					type: "array",
					items: {
						type: "object",
						properties: {
							id: { type: "string" },
							nttNo: { type: "string" },
							title: { type: "string" },
							category: { type: "string" },
							dept: { type: "string" },
							summary: { type: "string" },
							content: { type: "string" },
							deadline: { type: "string" },
							date: { type: "string" },
							url: { type: "string" },
							tags: { type: "array", items: { type: "string" } },
							urgent: { type: "boolean" },
							attachments: {
								type: "array",
								items: {
									type: "object",
									properties: {
										name: { type: "string" },
										url: { type: "string" },
									},
									required: ["name", "url"],
								},
							},
						},
						required: ["id", "nttNo", "title", "category", "dept", "summary", "content", "deadline", "date", "url", "tags", "urgent", "attachments"],
					},
				},
			},
			required: ["notices"],
		}),
		"",
		"입력 데이터:",
		JSON.stringify(rawItems, null, 2),
	].join("\n");

	const response = await fetch(`${String(config.url).replace(/\/$/, "")}/api/chat`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			model: config.model,
			stream: false,
			format: "json",
			messages: [
				{ role: "system", content: config.systemPrompt || "당신은 한국 대학 공지를 JSON으로 정리하는 데이터 처리기입니다." },
				{ role: "user", content: prompt },
			],
		}),
	});

	if (!response.ok) {
		throw new Error(`Ollama HTTP ${response.status} ${response.statusText}`);
	}
	const payload = await response.json();
	const content = payload.message?.content || payload.response || "";
	let parsed;
	try { parsed = JSON.parse(content); }
	catch (e) { throw new Error(`Ollama 응답 JSON 파싱 실패: ${e.message}`); }

	const notices = Array.isArray(parsed) ? parsed : parsed.notices;
	if (!Array.isArray(notices)) throw new Error("Ollama 응답에 notices 배열이 없습니다.");
	return notices;
}

function dedupeByNttNo(items) {
	const map = new Map();
	for (const item of items) {
		if (!item.nttNo) continue;
		if (!map.has(item.nttNo)) map.set(item.nttNo, item);
	}
	return Array.from(map.values());
}

function parseArgs(argv) {
	const args = { pages: 1, limit: 0 };
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === "--help" || arg === "-h") { args.help = true; continue; }
		if (arg === "--no-ollama") { args.noOllama = true; continue; }
		if (!arg.startsWith("--")) continue;
		const key = arg.slice(2);
		const value = argv[i + 1];
		if (value === undefined || value.startsWith("--")) {
			throw new Error(`--${key} 옵션 값이 필요합니다.`);
		}
		args[key] = value;
		i += 1;
	}
	args.pages = Number(args.pages) || 1;
	args.limit = Number(args.limit) || 0;
	return args;
}

function printHelp() {
	console.log(`
CampusLens 경기대 컴퓨터공학전공 공지 크롤러

Usage:
  npm run crawl -- [options]

Options:
  --pages <n>          순회할 pageIndex 수, 기본값: 1
  --limit <n>          상세 페이지 최대 수집 수, 0이면 제한 없음
  --no-ollama          Ollama 호출을 건너뛰고 fallback 정규화만 사용
  --help               도움말 출력
`.trim());
}

async function crawlList(pages) {
	const collected = [];
	for (let page = 1; page <= pages; page += 1) {
		const url = buildListUrl(page);
		console.log(`[list] page ${page}: ${url}`);
		try {
			const html = await fetchHtml(url);
			collected.push(...parseList(html));
		} catch (e) {
			console.warn(`[list] page ${page} 실패: ${e.message}`);
		}
	}
	return dedupeByNttNo(collected);
}

async function crawlDetails(items, limit) {
	const target = limit > 0 ? items.slice(0, limit) : items;
	const results = [];
	for (const item of target) {
		try {
			console.log(`[detail] nttNo=${item.nttNo}`);
			const detail = await fetchDetail(item.nttNo);
			results.push({ item, detail });
		} catch (e) {
			console.warn(`[detail] nttNo=${item.nttNo} 실패: ${e.message}`);
			results.push({ item, detail: { url: buildDetailUrl(item.nttNo), title: item.title, content: "", attachments: [] } });
		}
	}
	return results;
}

function buildRawForLlm(pairs) {
	return pairs.map(({ item, detail }) => ({
		id: `notice_${item.nttNo}`,
		nttNo: item.nttNo,
		title: detail.title || item.title,
		listCategory: item.category,
		dept: item.dept,
		date: item.date,
		url: detail.url,
		content: detail.content || "",
		attachments: detail.attachments || [],
	}));
}

async function main() {
	let args;
	try { args = parseArgs(process.argv.slice(2)); }
	catch (e) { console.error(e.message); process.exitCode = 1; return; }

	if (args.help) { printHelp(); return; }

	const listItems = await crawlList(args.pages);
	console.log(`[list] collected ${listItems.length} unique items`);
	if (!listItems.length) {
		console.warn("크롤링 결과가 비어 있습니다. notices.json을 변경하지 않습니다.");
		return;
	}

	const pairs = await crawlDetails(listItems, args.limit);
	const fallbackNotices = pairs.map(({ item, detail }) => buildFallbackNotice(item, detail));

	let finalNotices = fallbackNotices;
	let usedFallback = true;

	if (!args.noOllama) {
		const config = await loadOllamaConfig();
		if (!config) {
			console.warn("[ollama] ollama_config.json 을 찾을 수 없어 fallback 만 사용합니다.");
		} else {
			try {
				console.log(`[ollama] normalizing with ${config.model} via ${config.url}`);
				const rawForLlm = buildRawForLlm(pairs);
				const llmNotices = await normalizeWithOllama(rawForLlm, config);
				if (Array.isArray(llmNotices) && llmNotices.length) {
					finalNotices = llmNotices.map((n, i) => ({
						...fallbackNotices[i],
						...n,
						id: n.id || `notice_${n.nttNo || fallbackNotices[i].nttNo}`,
						nttNo: n.nttNo || fallbackNotices[i].nttNo,
						url: n.url || fallbackNotices[i].url,
						attachments: Array.isArray(n.attachments) ? n.attachments : fallbackNotices[i].attachments,
						tags: Array.isArray(n.tags) ? n.tags.slice(0, 5) : fallbackNotices[i].tags,
					}));
					usedFallback = false;
				}
			} catch (e) {
				console.warn(`[ollama] 실패: ${e.message} — fallback 사용`);
			}
		}
	}

	finalNotices = dedupeByNttNo(finalNotices);
	await ensureDir(PUBLIC_DIR);
	await writeJson(NOTICES_FILE, finalNotices);

	console.log(JSON.stringify({
		ok: true,
		count: finalNotices.length,
		fallback: usedFallback,
		output: path.relative(process.cwd(), NOTICES_FILE),
	}, null, 2));
}

main().catch((error) => {
	console.error(`[error] ${error.message}`);
	process.exitCode = 1;
});
