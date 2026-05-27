import {
  DATA_DIR,
  NOTICES_FILE,
  PUBLIC_DIR,
  RESTAURANTS_FILE,
  SESSION_FILE,
  USER_DIR,
  ensureDir,
  fileExists,
  writeJson,
  writeJsonIfMissing,
  userDir,
  userFile,
} from "./fileStore.js";
import { hashPassword, normalizeEmail } from "./userStore.js";

const NOTICES_SEED = [
  {
    id: "notice_seed_1",
    nttNo: "624101",
    title: "2026학년도 1학기 컴퓨터공학전공 종합설계 발표회 안내",
    category: "학사",
    dept: "컴퓨터공학전공",
    summary: "캡스톤 종합설계 최종 발표회 일정과 참가팀 명단을 안내합니다.",
    content: "2026학년도 1학기 컴퓨터공학전공 종합설계(캡스톤디자인) 최종 발표회를 진행합니다.\n\n- 일시: 2026.06.12 (금) 13:00 ~ 18:00\n- 장소: 제2공학관 8동 207호\n- 발표 시간: 팀당 15분 (발표 10분 + Q&A 5분)\n- 참가 대상: 캡스톤디자인 수강생 전원\n\n발표 자료는 6월 10일 17시까지 학과 사무실로 제출해 주시기 바랍니다.",
    deadline: "06.10",
    date: "2026-05-25",
    url: "https://www.kyonggi.ac.kr/u_computer/selectBbsNttView.do?key=8824&bbsNo=1073&nttNo=624101",
    tags: ["캡스톤", "발표회", "학사"],
    urgent: true,
    attachments: [],
  },
  {
    id: "notice_seed_2",
    nttNo: "624080",
    title: "2026학년도 하계 글로벌 SW 인턴십 모집",
    category: "취업",
    dept: "컴퓨터공학전공",
    summary: "여름방학 동안 해외 파트너 기업에서 진행되는 SW 인턴십 참가자를 모집합니다.",
    content: "2026 여름방학 글로벌 SW 인턴십 참가자를 모집합니다.\n\n- 파견 국가: 미국 / 싱가포르 / 일본\n- 기간: 2026.07.01 ~ 2026.08.31 (8주)\n- 모집 인원: 국가별 5명 내외\n- 자격: 직전 학기 평점 3.3 이상, TOEIC 750 이상\n- 지원: 항공료 전액, 현지 체재비 일부\n\n신청 마감 후 영어 면접이 진행되며, 결과는 개별 안내됩니다.",
    deadline: "06.05",
    date: "2026-05-20",
    url: "https://www.kyonggi.ac.kr/u_computer/selectBbsNttView.do?key=8824&bbsNo=1073&nttNo=624080",
    tags: ["인턴십", "글로벌", "취업"],
    urgent: false,
    attachments: [
      {
        name: "글로벌SW인턴십_지원서.hwp",
        url: "https://www.kyonggi.ac.kr/cmm/fms/FileDown.do?atchFileId=seed1&fileSn=0",
      },
    ],
  },
  {
    id: "notice_seed_3",
    nttNo: "624050",
    title: "2026-1학기 중간 강의평가 실시 안내",
    category: "학사",
    dept: "컴퓨터공학전공",
    summary: "수강 중인 과목의 중간 강의평가를 기간 내에 진행해야 합니다.",
    content: "2026학년도 1학기 중간 강의평가를 실시합니다.\n\n- 평가 기간: 2026.05.20 ~ 2026.05.27\n- 방법: KUTIS 학사정보시스템 → 강의평가\n- 대상: 수강 중인 전체 강의\n\n기간 내 미참여 시 일부 학사 서비스 이용이 제한될 수 있습니다.",
    deadline: "05.27",
    date: "2026-05-15",
    url: "https://www.kyonggi.ac.kr/u_computer/selectBbsNttView.do?key=8824&bbsNo=1073&nttNo=624050",
    tags: ["강의평가", "학사", "필수"],
    urgent: true,
    attachments: [],
  },
  {
    id: "notice_seed_4",
    nttNo: "624010",
    title: "정보처리기사 자격증 대비 특강 모집",
    category: "기타",
    dept: "컴퓨터공학전공",
    summary: "정보처리기사 필기 대비 특강 신청을 받습니다. 선착순 모집입니다.",
    content: "2026년 정기 정보처리기사 시험 대비 필기 특강을 개설합니다.\n\n- 모집 기간: 2026.05.10 ~ 2026.06.10 (선착순)\n- 모집 인원: 60명 (30명 단위 분반)\n- 강의 기간: 2026.06.17 ~ 2026.08.05 (주 2회)\n- 장소: IT융합관 207호\n- 수강료: 무료, 교재비 별도\n\n전공 무관하게 신청 가능합니다.",
    deadline: "06.10",
    date: "2026-05-08",
    url: "https://www.kyonggi.ac.kr/u_computer/selectBbsNttView.do?key=8824&bbsNo=1073&nttNo=624010",
    tags: ["자격증", "특강", "비교과"],
    urgent: false,
    attachments: [],
  },
  {
    id: "notice_seed_5",
    nttNo: "623990",
    title: "2026학년도 1학기 학과별 프로그래밍 경진대회",
    category: "행사",
    dept: "컴퓨터공학전공",
    summary: "전공생 프로그래밍 경진대회 참가팀을 모집합니다. 수상 시 마일리지가 지급됩니다.",
    content: "컴퓨터공학전공에서 주관하는 2026학년도 1학기 학과별 프로그래밍 경진대회 참가팀을 모집합니다.\n\n- 신청 기간: 2026.05.05 ~ 2026.05.30\n- 자격: 컴퓨터공학전공 재학생 (휴학생 제외)\n- 팀 구성: 1~3명\n- 시상: 대상 1팀 100만원, 최우수상 2팀, 우수상 3팀\n\n수상자에게는 비교과 마일리지 200점이 지급되며, 우수 팀은 교외 대회 참가비를 지원합니다.",
    deadline: "05.30",
    date: "2026-05-05",
    url: "https://www.kyonggi.ac.kr/u_computer/selectBbsNttView.do?key=8824&bbsNo=1073&nttNo=623990",
    tags: ["대회", "전공", "마감임박"],
    urgent: true,
    attachments: [],
  },
  {
    id: "notice_seed_6",
    nttNo: "623950",
    title: "2026학년도 2학기 학과 장학금 신청 안내",
    category: "장학",
    dept: "컴퓨터공학전공",
    summary: "2026학년도 2학기 학과 성적 우수 장학금 신청을 받습니다.",
    content: "2026학년도 2학기 학과 장학금 신청 안내입니다.\n\n- 신청 기간: 2026.06.01 ~ 2026.06.20\n- 대상: 직전 학기 평점 3.5 이상 재학생\n- 제출 서류: 장학금 신청서, 성적 증명서\n- 제출처: 학과 사무실 (공학관 305호)\n\n자세한 사항은 학과 홈페이지를 참고하세요.",
    deadline: "06.20",
    date: "2026-05-03",
    url: "https://www.kyonggi.ac.kr/u_computer/selectBbsNttView.do?key=8824&bbsNo=1073&nttNo=623950",
    tags: ["장학금", "학과"],
    urgent: false,
    attachments: [
      {
        name: "장학금_신청서_2026_2.hwp",
        url: "https://www.kyonggi.ac.kr/cmm/fms/FileDown.do?atchFileId=seed2&fileSn=0",
      },
    ],
  },
];

const RESTAURANTS_SEED = [
  {
    id: "core",
    name: "감성코어",
    desc: "제3복지관 1층",
    icon: "🍽️",
    gradient: "gradient-a",
    weeklyMeals: {
      "0": [],
      "1": [{ type: "점심", menu: "치킨 마요덮밥", desc: "샐러드, 미소국, 단무지", time: "11:00 - 14:00" }],
      "2": [{ type: "점심", menu: "돈까스 카레덮밥", desc: "양배추 샐러드, 단무지", time: "11:00 - 14:00" }],
      "3": [{ type: "점심", menu: "불고기 비빔밥", desc: "계란 후라이, 콩나물국", time: "11:00 - 14:00" }],
      "4": [{ type: "점심", menu: "새우 볶음밥", desc: "군만두 2개, 계란국", time: "11:00 - 14:00" }],
      "5": [{ type: "점심", menu: "제육 덮밥", desc: "양상추 샐러드, 된장국", time: "11:00 - 14:00" }],
      "6": [],
    },
  },
  {
    id: "dream",
    name: "경기대 드림타워 식당",
    desc: "기숙사 1층",
    icon: "🏠",
    gradient: "gradient-b",
    weeklyMeals: {
      "0": [
        { type: "아침", menu: "브런치 토스트", desc: "우유, 과일 컵", time: "08:00 - 10:00" },
        { type: "점심", menu: "치킨 스튜", desc: "흰쌀밥, 옥수수 샐러드", time: "11:30 - 13:30" },
        { type: "저녁", menu: "순두부 찌개", desc: "잡곡밥, 김치, 계란말이", time: "17:30 - 19:30" },
      ],
      "1": [
        { type: "아침", menu: "토스트 + 스크램블", desc: "샐러드, 우유 또는 주스", time: "07:30 - 09:00" },
        { type: "점심", menu: "제육볶음 정식", desc: "잡곡밥, 미역국, 계란말이", time: "11:30 - 13:30" },
        { type: "저녁", menu: "김치찌개", desc: "흰쌀밥, 계란찜, 김", time: "17:30 - 19:30" },
      ],
      "2": [
        { type: "아침", menu: "단호박죽", desc: "백김치, 두유", time: "07:30 - 09:00" },
        { type: "점심", menu: "닭갈비 덮밥", desc: "오이무침, 콩나물국", time: "11:30 - 13:30" },
        { type: "저녁", menu: "된장찌개", desc: "잡곡밥, 멸치볶음, 김", time: "17:30 - 19:30" },
      ],
      "3": [
        { type: "아침", menu: "베이글 + 크림치즈", desc: "우유, 사과", time: "07:30 - 09:00" },
        { type: "점심", menu: "카레라이스", desc: "단무지, 미역국", time: "11:30 - 13:30" },
        { type: "저녁", menu: "순두부찌개", desc: "잡곡밥, 깍두기, 김자반", time: "17:30 - 19:30" },
      ],
      "4": [
        { type: "아침", menu: "샌드위치 + 우유", desc: "바나나", time: "07:30 - 09:00" },
        { type: "점심", menu: "비빔밥", desc: "고추장, 콩나물국", time: "11:30 - 13:30" },
        { type: "저녁", menu: "부대찌개", desc: "잡곡밥, 무생채, 김", time: "17:30 - 19:30" },
      ],
      "5": [
        { type: "아침", menu: "오트밀 + 과일", desc: "우유, 견과류", time: "07:30 - 09:00" },
        { type: "점심", menu: "돈까스 정식", desc: "양배추 샐러드, 미소국", time: "11:30 - 13:30" },
        { type: "저녁", menu: "육개장", desc: "잡곡밥, 깍두기, 김", time: "17:30 - 19:30" },
      ],
      "6": [
        { type: "아침", menu: "팬케이크", desc: "메이플 시럽, 우유", time: "08:00 - 10:00" },
        { type: "점심", menu: "김치볶음밥", desc: "계란 후라이, 미소국", time: "11:30 - 13:30" },
        { type: "저녁", menu: "제육 정식", desc: "잡곡밥, 상추, 된장국", time: "17:30 - 19:30" },
      ],
    },
  },
];

export const DEMO_USER = {
  id: "user_demo_student",
  email: "student@campuslens.dev",
  name: "데모학생",
  password: "campus123",
};

const DEMO_TASKS_SEED = [
  {
    id: "task_demo_1",
    title: "웹프로그래밍 과제 1 제출",
    course: "웹프로그래밍",
    type: "과제",
    due: "2026-05-29",
    time: "23:59",
    completed: false,
  },
  {
    id: "task_demo_2",
    title: "자료구조 중간 발표",
    course: "자료구조",
    type: "발표",
    due: "2026-05-28",
    time: "13:00",
    completed: false,
  },
  {
    id: "task_demo_3",
    title: "캡스톤 종합설계 시연 자료",
    course: "캡스톤디자인",
    type: "프로젝트",
    due: "2026-06-10",
    time: "17:00",
    completed: false,
  },
];

const DEMO_CLASSES_SEED = [
  { id: "class_demo_1", day: "월", time: "10:00", duration: 2, name: "웹프로그래밍", room: "8501", color: "" },
  { id: "class_demo_2", day: "화", time: "13:00", duration: 2, name: "자료구조", room: "8302", color: "color-b" },
  { id: "class_demo_3", day: "수", time: "15:00", duration: 3, name: "컴퓨터구조", room: "8404", color: "color-c" },
  { id: "class_demo_4", day: "목", time: "11:00", duration: 2, name: "캡스톤디자인", room: "8207", color: "color-d" },
  { id: "class_demo_5", day: "금", time: "14:00", duration: 2, name: "알고리즘", room: "8301", color: "color-e" },
];

export async function ensureSeedData() {
  await ensureDir(DATA_DIR);
  await ensureDir(PUBLIC_DIR);
  await ensureDir(USER_DIR);
  await writeJsonIfMissing(SESSION_FILE, []);
  await writeJsonIfMissing(NOTICES_FILE, NOTICES_SEED);
  await writeJsonIfMissing(RESTAURANTS_FILE, RESTAURANTS_SEED);

  const demoInfoPath = userFile(DEMO_USER.id, "info");
  if (!(await fileExists(demoInfoPath))) {
    await ensureDir(userDir(DEMO_USER.id));
    const now = new Date().toISOString();
    await writeJson(demoInfoPath, {
      id: DEMO_USER.id,
      email: normalizeEmail(DEMO_USER.email),
      name: DEMO_USER.name,
      passwordHash: hashPassword(DEMO_USER.password),
      createdAt: now,
      updatedAt: now,
    });
    await writeJson(userFile(DEMO_USER.id, "tasks"), DEMO_TASKS_SEED);
    await writeJson(userFile(DEMO_USER.id, "classes"), DEMO_CLASSES_SEED);
  }
}
