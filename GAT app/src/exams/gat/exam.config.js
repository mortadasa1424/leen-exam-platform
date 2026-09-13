// GAT exam definition — the one file that describes "what GAT is" to the
// reusable platform. See docs/PLATFORM.md for the exam-module contract this
// feeds into (src/exams/gat/index.js) and how to add another exam.
//
// Nothing here should be imported directly by UI components — components
// import the active exam via src/exams/active.js instead, so swapping which
// exam is "live" is a one-line change there, not a search-and-replace here.
import { GENERAL_CATEGORIES, SPECIFIC_TO_GENERAL } from "./categories.js";

const COURSE_URL_BASE = "https://leen.sa/courses/gat-qudrat";
const UTM_PARAMS = "utm_source=APP&utm_medium=Exam&utm_campaign=GAT26";
const WHATSAPP_NUMBER = "966557841489";

export default {
  id: "gat",
  name: "GAT",
  shortName: "GAT",
  description: "Free GAT Exam Practice — Quantitative and Verbal practice tests, built to mirror the real GAT exam.",

  // Prefixes every localStorage/sessionStorage key this exam uses (see
  // src/lib/storageKeys.js). Unchanged from the app's original hardcoded
  // "leen_gat_*" keys, so existing saved attempts keep resolving.
  storagePrefix: "leen_gat",

  // Platform UI language/direction (src/i18n/*.js) — independent from
  // question-content direction, which is always detected per-question from
  // its actual text (see QuestionCard.jsx's isArabicText/promptDir). GAT's
  // platform chrome is English/LTR.
  locale: {
    language: "en",
    direction: "ltr",
  },

  sections: [
    {
      id: "quantitative",
      name: "Quantitative Section",
      description: "Practice all three Quantitative tests",
      icon: "calculator",
      // Drives QuestionCard's math-card styling / math-option sizing —
      // a rendering capability, not a hardcoded "quantitative" string check.
      mathRendering: true,
      // `title` names the test in the quiz header/results (testTitle);
      // `tileTitle` is the shorter label shown on the Section Select tile —
      // these were two distinct hardcoded strings in the original app
      // (SectionSelect's TEST_LABELS vs. schema.js's TEST_META), kept
      // distinct here rather than collapsed into one.
      tests: [
        { key: "quant1", title: "Quantitative - Test 1", tileTitle: "Quantitative Test 1" },
        { key: "quant2", title: "Quantitative - Test 2", tileTitle: "Quantitative Test 2" },
        { key: "quant3", title: "Quantitative - Test 3", tileTitle: "Quantitative Test 3" },
      ],
    },
    {
      id: "verbal",
      name: "Verbal Section",
      description: "Practice all three Verbal tests",
      icon: "bookOpen",
      // Preserves the original explicit aria-label on this Home button
      // (the quantitative button has none, relying on its visible text).
      ariaLabel: "Verbal Section",
      mathRendering: false,
      tests: [
        { key: "verbal1", title: "Verbal - Test 1", tileTitle: "Verbal Test 1" },
        { key: "verbal2", title: "Verbal - Test 2", tileTitle: "Verbal Test 2" },
        { key: "verbal3", title: "Verbal - Test 3", tileTitle: "Verbal Test 3" },
      ],
    },
  ],

  // Single unified overall test timer — no per-question timers. Student
  // toggles it on the start screen; defaultOn matches today's fixed "false".
  timer: {
    minutes: 60,
    defaultOn: false,
  },

  categories: {
    general: GENERAL_CATEGORIES,
    specificToGeneral: SPECIFIC_TO_GENERAL,
  },

  // Whether the platform offers category-based performance reporting
  // ("Performance by Skill" on Results, the weakest-area callout, category
  // breakdown cards). GAT's questions carry real category data, so this
  // stays on. An exam with no meaningful category taxonomy sets this false
  // and doesn't need to supply `categories`/generalCategory at all — see
  // docs/PLATFORM.md.
  performance: {
    byCategory: true,
  },

  // Exam-specific hero copy for the Home screen (distinct from the Leen
  // company brand in src/config/brand.js, which doesn't change per exam).
  branding: {
    heroTitle: "Free GAT Exam Practice",
    heroLede: "Quantitative and Verbal practice tests, built to mirror the real GAT exam.",
  },

  marketing: {
    courseUrl: `${COURSE_URL_BASE}?${UTM_PARAMS}`,
    whatsappNumber: WHATSAPP_NUMBER,
    whatsappUrl: `https://api.whatsapp.com/send/?phone=${WHATSAPP_NUMBER}&text&type=phone_number&app_absent=0`,
    promoVideo: "/assets/marketing/vid.mp4",
    footerBanner: "/assets/marketing/gat-course-banner2.png",
    // UI copy that names the exam/course — kept here (not hardcoded in
    // components) since a future exam's course name/copy will differ.
    copy: {
      footerAriaLabel: "GAT course ad",
      footerBannerAlt: "GAT course",
      footerBannerAriaLabel: "Enroll in the GAT course now",
      courseFooterText: "To enroll in the GAT prep course, click ",
      helpLinkText: "Enroll in the GAT prep course",
      popupAriaLabel: "Enroll in the GAT course",
    },
  },

  leadCapture: {
    enabled: true,
    // Set by public/lead-config.js at deploy time; read as window[<this>].
    webhookGlobalVar: "LEEN_GAT_GOOGLE_SHEETS_WEBHOOK_URL",
    countries: [
      { label: "Saudi Arabia", code: "+966", iso: "SA", flagSrc: "/assets/flags/sa.svg" },
      { label: "UAE", code: "+971", iso: "AE", flagSrc: "/assets/flags/ae.svg" },
      { label: "Kuwait", code: "+965", iso: "KW", flagSrc: "/assets/flags/kw.svg" },
      { label: "Qatar", code: "+974", iso: "QA", flagSrc: "/assets/flags/qa.svg" },
      { label: "Bahrain", code: "+973", iso: "BH", flagSrc: "/assets/flags/bh.svg" },
      { label: "Oman", code: "+968", iso: "OM", flagSrc: "/assets/flags/om.svg" },
    ],
    // The displayed label IS the value sent to Apps Script and stored in the
    // sheet verbatim — no internal alias/code. Keep in sync with the
    // receiving Code.gs's ALLOWED_GRADE_LEVELS.
    gradeLevels: ["10th Grade", "11th Grade", "12th Grade", "Other"],
  },
};
