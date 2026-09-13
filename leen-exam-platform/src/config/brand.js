// Leen company identity — the logo and name are constant across every exam
// product built on this platform (GAT, SAAT, STEP, ...), unlike marketing
// (course link, WhatsApp, promo assets) which is per-exam and lives in each
// exam's exam.config.js instead. See docs/PLATFORM.md.

export const COMPANY_NAME = "Leen";

export const LOGO_LIGHT = "/assets/brand/leen-logo.png";
export const LOGO_DARK = "/assets/brand/leen-logo-dark.png";

// Leen's single company WhatsApp contact — fixed across every exam product
// built on this platform (unlike courseUrl/promoVideo/footerBanner, which
// are per-exam marketing and live in each exam's exam.config.js). There is
// one WhatsApp number for the whole platform, not one per exam.
export const WHATSAPP_NUMBER = "966557841489";
export const WHATSAPP_URL = `https://api.whatsapp.com/send/?phone=${WHATSAPP_NUMBER}&text&type=phone_number&app_absent=0`;
