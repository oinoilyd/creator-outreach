/**
 * Per-region "is this channel actually from / for this region?" signals.
 *
 * Used by /api/search after the candidate pool is built to drop
 * channels that match the keyword but show NO regional fingerprint.
 * The earlier behavior was to send region-tagged queries to YouTube
 * and trust the rankings — which leaks global creators in for any
 * region with a strong English content overlap (notably IN where
 * English-language Indian content competes with US/UK content of
 * the same words).
 *
 * Two-tier signal model:
 *
 *   STRONG (confidence = 2)
 *     - Channel name contains a strong regional keyword (city,
 *       country adjective, regulator, currency code, language name)
 *     - Channel name contains characters from a regional script
 *       (Devanagari for IN, Hangul for KR, etc.)
 *     - A representative video title contains a regional script
 *
 *   WEAK (confidence = 1)
 *     - Video titles contain a strong regional keyword
 *     - Channel name contains a weak regional keyword (slang,
 *       sport, pop-culture term)
 *
 *   NONE (confidence = 0)
 *     - Filtered out when the user picked this region, unless the
 *       adaptive relax kicks in for thin result sets.
 *
 * The English-dominant regions (US/GB/CA/AU/NZ/IE) get a special
 * lenient treatment — most channels in English target those
 * audiences, so we only drop a channel from those regions if it has
 * a STRONG signal from a DIFFERENT region (e.g. all-Devanagari
 * titles when the user picked US).
 */

export type RegionSignal = {
  /** Unicode codepoint ranges that strongly suggest this region's
   *  content. Used to detect Devanagari / Tamil / Hangul / etc. */
  scripts: Array<[number, number]>
  /** High-confidence regional words. Word-boundaried, case-
   *  insensitive. Country + adjective + cities + regulators + currency. */
  strong: string[]
  /** Lower-confidence regional words. Slang, pop culture, less
   *  unique context. */
  weak: string[]
  /** True for English-dominant regions where most channels are
   *  valid by default — we only drop those that show STRONG
   *  signal from a *different* region. */
  englishDominant: boolean
}

const DEVANAGARI: [number, number] = [0x0900, 0x097F]
const BENGALI: [number, number] = [0x0980, 0x09FF]
const GURMUKHI: [number, number] = [0x0A00, 0x0A7F]
const GUJARATI: [number, number] = [0x0A80, 0x0AFF]
const ORIYA: [number, number] = [0x0B00, 0x0B7F]
const TAMIL: [number, number] = [0x0B80, 0x0BFF]
const TELUGU: [number, number] = [0x0C00, 0x0C7F]
const KANNADA: [number, number] = [0x0C80, 0x0CFF]
const MALAYALAM: [number, number] = [0x0D00, 0x0D7F]
const HIRAGANA: [number, number] = [0x3040, 0x309F]
const KATAKANA: [number, number] = [0x30A0, 0x30FF]
const CJK_UNIFIED: [number, number] = [0x4E00, 0x9FFF]
const HANGUL_JAMO: [number, number] = [0x1100, 0x11FF]
const HANGUL_SYLLABLES: [number, number] = [0xAC00, 0xD7AF]
const ARABIC: [number, number] = [0x0600, 0x06FF]
const THAI: [number, number] = [0x0E00, 0x0E7F]

export const REGION_SIGNALS: Record<string, RegionSignal> = {
  IN: {
    scripts: [DEVANAGARI, BENGALI, GURMUKHI, GUJARATI, ORIYA, TAMIL, TELUGU, KANNADA, MALAYALAM],
    strong: [
      'india', 'indian', 'bharat', 'hindustan',
      'hindi', 'tamil', 'telugu', 'marathi', 'gujarati', 'punjabi',
      'kannada', 'malayalam', 'bengali', 'bangla', 'urdu', 'kashmiri',
      'mumbai', 'delhi', 'bangalore', 'bengaluru', 'chennai', 'kolkata',
      'hyderabad', 'pune', 'ahmedabad', 'jaipur', 'lucknow', 'noida',
      'gurgaon', 'gurugram', 'kerala', 'goa', 'maharashtra', 'gujarat',
      'rajasthan', 'punjab', 'haryana', 'bihar', 'odisha', 'assam',
      'chandigarh', 'kashmir', 'ladakh', 'sikkim',
      'rbi', 'sebi', 'nse', 'bse', 'sensex', 'nifty', 'gst', 'upi',
      'paytm', 'phonepe', 'zerodha', 'groww', 'flipkart', 'jio',
      'bollywood', 'tollywood', 'kollywood',
      'iit', 'iim', 'aiims', 'upsc', 'neet', 'iit-jee', 'iitm', 'iitb', 'iitd',
      'rupee', 'inr', 'paisa',
    ],
    weak: [
      'desi', 'swadeshi', 'bharatiya', 'pradesh', 'modi', 'rajya',
      'samosa', 'biryani', 'paneer',
    ],
    englishDominant: false,
  },

  US: {
    scripts: [],
    strong: [
      'usa', 'america', 'american', 'united states',
      'nyc', 'new york', 'manhattan', 'brooklyn', 'queens', 'bronx',
      'la county', 'los angeles', 'hollywood', 'san francisco',
      'silicon valley', 'bay area', 'chicago', 'boston', 'atlanta',
      'seattle', 'detroit', 'philadelphia', 'phoenix', 'denver',
      'portland', 'austin', 'dallas', 'houston', 'san diego',
      'miami', 'orlando', 'vegas', 'nashville', 'charlotte', 'd.c.',
      'california', 'texas', 'florida',
      'nyse', 'nasdaq', 'irs', 'sec', 'fdic', 'sba',
      'roth ira', '401k', 'medicare', 'medicaid', 'social security',
      'walmart', 'amazon usa', 'usaa',
      'nfl', 'nba', 'mlb', 'nhl', 'super bowl',
    ],
    weak: ['fed', 'congress', 'senate', 'usd'],
    englishDominant: true,
  },

  GB: {
    scripts: [],
    strong: [
      'uk', 'united kingdom', 'great britain', 'britain', 'british',
      'england', 'english', 'scotland', 'scottish', 'wales', 'welsh',
      'london', 'manchester', 'birmingham', 'leeds', 'liverpool',
      'glasgow', 'edinburgh', 'bristol', 'cardiff', 'brighton',
      'hmrc', 'hsbc uk', 'lloyds', 'barclays', 'natwest', 'tesco',
      'nhs', 'bbc', 'itv', 'sky news', 'channel 4',
      'isa', 'sipp', 'pension uk', 'brexit',
      'whitehall', 'westminster', 'parliament uk',
      'tory', 'labour party', 'conservative party',
      'pound sterling', 'gbp', 'pence',
    ],
    weak: ['queue', 'rubbish', 'cheers mate', 'innit', 'mate'],
    englishDominant: true,
  },

  CA: {
    scripts: [],
    strong: [
      'canada', 'canadian',
      'toronto', 'vancouver', 'montreal', 'calgary', 'edmonton',
      'ottawa', 'winnipeg', 'quebec', 'halifax', 'victoria',
      'ontario', 'british columbia', 'alberta', 'manitoba', 'saskatchewan',
      'cra', 'tfsa', 'rrsp', 'cpp', 'gst hst',
      'rbc', 'td canada', 'bmo', 'cibc', 'scotiabank',
      'tim hortons', 'loonie', 'cad ',
      'nhl canada', 'cfl', 'mls canada',
    ],
    weak: ['eh', 'poutine', 'maple', 'beaver'],
    englishDominant: true,
  },

  AU: {
    scripts: [],
    strong: [
      'australia', 'australian', 'aussie',
      'sydney', 'melbourne', 'brisbane', 'perth', 'adelaide',
      'canberra', 'gold coast', 'hobart', 'darwin',
      'new south wales', 'queensland', 'victoria au', 'western australia',
      'ato', 'asx', 'aud ', 'super annuation', 'superannuation',
      'commonwealth bank', 'westpac', 'anz bank', 'nab australia',
      'centrelink', 'medicare au',
      'afl', 'nrl', 'a-league',
    ],
    weak: ['mate ', 'arvo', 'g\'day', 'fair dinkum'],
    englishDominant: true,
  },

  NZ: {
    scripts: [],
    strong: [
      'new zealand', 'aotearoa', 'kiwi', 'nz ',
      'auckland', 'wellington', 'christchurch', 'hamilton', 'tauranga',
      'dunedin', 'queenstown',
      'inland revenue nz', 'kiwisaver', 'reserve bank nz',
      'rugby nz', 'all blacks',
      'maori',
    ],
    weak: ['choice bro', 'sweet as'],
    englishDominant: true,
  },

  IE: {
    scripts: [],
    strong: [
      'ireland', 'irish', 'eire',
      'dublin', 'cork', 'galway', 'limerick', 'belfast',
      'revenue ireland', 'aib bank', 'bank of ireland',
      'gaeilge', 'gaa', 'guinness',
    ],
    weak: ['craic', 'grand'],
    englishDominant: true,
  },

  PH: {
    scripts: [],
    strong: [
      'philippines', 'filipino', 'pinoy', 'pinay',
      'manila', 'cebu', 'davao', 'quezon city', 'makati',
      'tagalog', 'visayan', 'cebuano', 'ilocano',
      'bdo', 'bpi philippines', 'gcash', 'paymaya', 'lazada ph',
      'pse', 'sss philippines', 'philhealth', 'pagibig', 'pag-ibig',
      'peso philippines', 'php ', 'kababayan',
    ],
    weak: ['lumpia', 'jeepney', 'kabayan', 'sari sari'],
    englishDominant: false,
  },

  SG: {
    scripts: [CJK_UNIFIED],
    strong: [
      'singapore', 'singaporean', 'sgporean',
      'orchard road', 'sentosa', 'jurong', 'changi', 'marina bay',
      'cpf', 'mas singapore', 'gic', 'temasek', 'iras',
      'dbs', 'ocbc', 'uob', 'standard chartered sg',
      'sgd ', 'singapore dollar',
      'hdb', 'bto flat', 'mrt singapore',
      'singlish',
    ],
    weak: ['lah', 'lor', 'leh', 'kiasu', 'shiok'],
    englishDominant: false,
  },

  NG: {
    scripts: [],
    strong: [
      'nigeria', 'nigerian', 'naija',
      'lagos', 'abuja', 'port harcourt', 'kano', 'ibadan',
      'cbn nigeria', 'gtbank', 'access bank', 'zenith bank',
      'fbn nigeria', 'opay nigeria', 'flutterwave', 'paystack',
      'nse nigeria', 'sec nigeria',
      'naira', 'ngn ',
      'jollof', 'afrobeats',
      'yoruba', 'igbo', 'hausa',
    ],
    weak: ['oga', 'wahala', 'sabi', 'gbam', 'pidgin'],
    englishDominant: false,
  },

  ZA: {
    scripts: [],
    strong: [
      'south africa', 'south african', 'mzansi', 'rsa ',
      'johannesburg', 'joburg', 'cape town', 'durban', 'pretoria',
      'sars south africa', 'fnb south africa', 'standard bank sa',
      'absa', 'nedbank', 'capitec',
      'jse', 'rand south africa', 'zar ',
      'afrikaans', 'xhosa', 'zulu', 'sotho',
      'springboks', 'proteas',
    ],
    weak: ['bru', 'lekker', 'howzit'],
    englishDominant: false,
  },

  AE: {
    scripts: [ARABIC],
    strong: [
      'uae', 'united arab emirates', 'emirati',
      'dubai', 'abu dhabi', 'sharjah', 'ajman', 'ras al khaimah',
      'mashreq', 'enbd', 'adcb', 'adib',
      'dfm', 'adx', 'difc',
      'dirham', 'aed ',
      'expo dubai',
    ],
    weak: ['inshallah', 'mashallah', 'habibi'],
    englishDominant: false,
  },

  DE: {
    scripts: [],
    strong: [
      'germany', 'german', 'deutschland', 'deutsch',
      'berlin', 'munich', 'münchen', 'hamburg', 'frankfurt', 'cologne',
      'köln', 'stuttgart', 'düsseldorf', 'leipzig', 'dresden',
      'bafin', 'bundesbank', 'kfw',
      'sparkasse', 'commerzbank', 'deutsche bank', 'dkb',
      'dax', 'mdax', 'xetra',
      'euro deutschland', 'riester', 'rürup', 'gmbh', 'kg deutschland',
      'finanzamt', 'krankenkasse', 'rente',
    ],
    weak: ['guten tag', 'danke', 'genau'],
    englishDominant: false,
  },

  FR: {
    scripts: [],
    strong: [
      'france', 'french', 'français', 'française',
      'paris', 'lyon', 'marseille', 'bordeaux', 'toulouse',
      'lille', 'nantes', 'strasbourg', 'nice france', 'montpellier',
      'amf france', 'banque de france', 'urssaf',
      'bnp paribas', 'société générale', 'crédit agricole',
      'cac 40', 'pea ', 'assurance vie', 'sci ',
      'auto-entrepreneur', 'micro-entreprise', 'sas france',
    ],
    weak: ['bonjour', 'merci'],
    englishDominant: false,
  },

  ES: {
    scripts: [],
    strong: [
      'spain', 'spanish españa', 'español españa', 'española',
      'madrid', 'barcelona', 'valencia', 'sevilla', 'málaga', 'zaragoza',
      'bilbao', 'palma', 'granada',
      'cnmv', 'banco de españa', 'bbva', 'santander españa',
      'caixabank', 'sabadell',
      'ibex 35', 'ibex35',
      'autónomo españa', 'seguridad social españa',
    ],
    weak: ['hola', 'gracias'],
    englishDominant: false,
  },

  BR: {
    scripts: [],
    strong: [
      'brasil', 'brazil', 'brasileiro', 'brasileira',
      'são paulo', 'sao paulo', 'rio de janeiro', 'brasília', 'salvador',
      'fortaleza', 'belo horizonte', 'curitiba', 'recife', 'porto alegre',
      'bcb brasil', 'cvm', 'b3 ', 'bovespa', 'ibovespa',
      'itau', 'bradesco', 'banco do brasil', 'caixa econômica',
      'nubank', 'inter brasil',
      'real brasileiro', 'brl ', 'tesouro direto', 'cdb', 'lci', 'lca',
      'mei brasil', 'simples nacional', 'cpf', 'cnpj',
    ],
    weak: ['olá', 'obrigado', 'opa'],
    englishDominant: false,
  },

  MX: {
    scripts: [],
    strong: [
      'mexico', 'méxico', 'mexicano', 'mexicana',
      'cdmx', 'ciudad de méxico', 'guadalajara', 'monterrey', 'puebla',
      'tijuana', 'mérida', 'cancún', 'oaxaca',
      'cnbv', 'banxico',
      'banamex', 'bbva mexico', 'banorte', 'santander mexico',
      'bmv', 'ipc mexicana',
      'peso mexicano', 'mxn ', 'afore', 'cetes', 'fibras',
      'sat mexico', 'imss',
    ],
    weak: ['hola', 'órale', 'amigo'],
    englishDominant: false,
  },

  JP: {
    scripts: [HIRAGANA, KATAKANA, CJK_UNIFIED],
    strong: [
      'japan', 'japanese', 'nihon', 'nippon',
      'tokyo', 'osaka', 'kyoto', 'yokohama', 'sapporo', 'nagoya',
      'fukuoka', 'kobe', 'hiroshima', 'sendai',
      'boj', 'fsa japan', 'jpx', 'tse japan',
      'mufg', 'mizuho', 'smbc', 'rakuten', 'softbank', 'mercari',
      'nikkei', 'topix',
      'yen', 'jpy ', 'nisa japan', 'ideco', 'idecho',
      'shinkansen', 'jr line',
    ],
    weak: ['arigatou', 'konnichiwa', 'kawaii', 'anime', 'manga'],
    englishDominant: false,
  },

  KR: {
    scripts: [HANGUL_JAMO, HANGUL_SYLLABLES],
    strong: [
      'korea', 'korean', 'south korea', 'hanguk', 'hankuk',
      'seoul', 'busan', 'incheon', 'daegu', 'gwangju', 'daejeon',
      'kospi', 'kosdaq', 'krx',
      'kakao', 'naver korea', 'kb kookmin', 'shinhan', 'hana bank',
      'samsung korea', 'hyundai', 'lg korea',
      'won korea', 'krw ',
      'k-pop', 'kpop', 'k-drama', 'hallyu', 'chaebol',
    ],
    weak: ['annyeong', 'kimchi', 'oppa', 'unnie', 'soju'],
    englishDominant: false,
  },

  ID: {
    scripts: [],
    strong: [
      'indonesia', 'indonesian',
      'jakarta', 'surabaya', 'bandung', 'medan', 'semarang',
      'palembang', 'makassar', 'denpasar', 'bali',
      'idx', 'ojk indonesia', 'bi indonesia',
      'bca indonesia', 'mandiri', 'bri', 'bni indonesia',
      'gojek', 'tokopedia', 'shopee indonesia', 'bukalapak',
      'rupiah', 'idr ',
      'bahasa indonesia', 'jawa', 'sunda',
    ],
    weak: ['terima kasih', 'selamat', 'pak ', 'mbak'],
    englishDominant: false,
  },
}

/**
 * Score a channel's regional confidence (0–2) using its name and a
 * sample of video titles. Pure: same inputs always score the same.
 */
export function regionConfidence(
  channelName: string,
  videoTitles: string[],
  gl: string,
): 0 | 1 | 2 {
  const sig = REGION_SIGNALS[gl]
  if (!sig) return 2 // unknown region — don't filter

  const lowerName = (channelName || '').toLowerCase()
  const titlesJoined = (videoTitles || []).join(' ')
  const lowerTitles = titlesJoined.toLowerCase()

  // Native script in name → strong signal (rare for English-dominant
  // regions but real for IN/JP/KR/AE).
  if (sig.scripts.length > 0) {
    if (containsScript(channelName, sig.scripts)) return 2
  }

  // Strong keyword in name → strong signal.
  if (matchesAny(lowerName, sig.strong)) return 2

  // Native script in titles → strong signal.
  if (sig.scripts.length > 0 && containsScript(titlesJoined, sig.scripts)) {
    return 2
  }

  // Strong keyword in titles → weak signal (titles are noisier than
  // channel names — a title can mention a city without the channel
  // being from there).
  if (matchesAny(lowerTitles, sig.strong)) return 1

  // Weak keyword in name or titles → weak signal.
  if (matchesAny(lowerName, sig.weak)) return 1
  if (matchesAny(lowerTitles, sig.weak)) return 1

  return 0
}

/**
 * For English-dominant regions (US/GB/CA/AU/NZ/IE), we only drop a
 * channel if it shows STRONG signal from a different region — most
 * channels in English are valid by default, and the user picking
 * "US" doesn't mean "must mention America by name."
 *
 * Returns true if the channel has strong signal from a region OTHER
 * than `gl` — caller drops it.
 */
export function hasForeignSignal(
  channelName: string,
  videoTitles: string[],
  gl: string,
): boolean {
  for (const otherGl of Object.keys(REGION_SIGNALS)) {
    if (otherGl === gl) continue
    const sig = REGION_SIGNALS[otherGl]
    // Strong: native script in name or titles.
    if (sig.scripts.length > 0) {
      if (
        containsScript(channelName, sig.scripts) ||
        containsScript(videoTitles.join(' '), sig.scripts)
      ) {
        return true
      }
    }
    // Strong: regional keyword in CHANNEL NAME (not titles — titles
    // can cross-reference other countries without being from there).
    if (matchesAny((channelName || '').toLowerCase(), sig.strong)) {
      return true
    }
  }
  return false
}

// ── helpers ────────────────────────────────────────────────────────

function containsScript(text: string, ranges: Array<[number, number]>): boolean {
  if (!text) return false
  for (const ch of text) {
    const cp = ch.codePointAt(0)
    if (cp == null) continue
    for (const [lo, hi] of ranges) {
      if (cp >= lo && cp <= hi) return true
    }
  }
  return false
}

// Cache compiled keyword regexes per region+tier so the per-channel
// match doesn't pay regex compile cost on every candidate.
const KEYWORD_RE_CACHE = new Map<string, RegExp>()

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchesAny(text: string, keywords: string[]): boolean {
  if (!text || keywords.length === 0) return false
  const cacheKey = keywords.length + ':' + keywords[0]
  let re = KEYWORD_RE_CACHE.get(cacheKey)
  if (!re) {
    // Word-boundary so "us" doesn't match "us" inside "usual".
    // Keywords with internal spaces (e.g. "new york") use \b on each
    // end too — JS \b before/after spaces still works.
    re = new RegExp(`\\b(?:${keywords.map(escapeRegex).join('|')})\\b`, 'i')
    KEYWORD_RE_CACHE.set(cacheKey, re)
  }
  return re.test(text)
}
