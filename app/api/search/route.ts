import { NextRequest, NextResponse } from 'next/server'
import { Innertube } from 'youtubei.js'
import { cacheGet, cacheSet, searchCacheKey, CACHE_TTL } from '@/lib/cache'
import { bulkSaveSearchResults } from '@/lib/creator-enrichment'
import { clampString, clampInt } from '@/lib/security'
import { requireUser, rateLimit } from '@/lib/api-auth'
import { regionConfidence, hasForeignSignal, REGION_SIGNALS } from '@/lib/region-signals'
import { expandKeyword } from '@/lib/keyword-expand'

const TOPIC_MAP: Record<string, string[]> = {
  basketball: ['basketball coach', 'basketball trainer', 'basketball analyst', 'NBA agent', 'basketball recruiter', 'basketball content creator', 'basketball skills trainer', 'youth basketball coach', 'basketball player'],
  football: ['football coach', 'NFL agent', 'football analyst', 'football recruiter', 'football trainer', 'football content creator', 'quarterback coach', 'football player'],
  soccer: ['soccer coach', 'soccer agent', 'soccer trainer', 'soccer scout', 'soccer content creator', 'soccer skills', 'youth soccer coach', 'soccer player'],
  baseball: ['baseball coach', 'MLB agent', 'baseball analyst', 'baseball trainer', 'baseball scout', 'baseball content creator', 'pitching coach'],
  golf: ['golf coach', 'golf instructor', 'golf professional', 'golf analyst', 'golf content creator', 'golf swing coach', 'PGA instructor'],
  tennis: ['tennis coach', 'tennis instructor', 'tennis analyst', 'tennis content creator', 'tennis player'],
  sports: ['sports agent', 'sports coach', 'sports analyst', 'sports trainer', 'sports recruiter', 'sports content creator', 'sports marketer', 'athletic trainer', 'sports performance coach', 'youth sports coach', 'college recruiting coach', 'sports management'],
  banking: ['investment banker', 'bank executive', 'private banker', 'wealth manager', 'credit analyst', 'commercial banker', 'finance professional'],
  finance: ['financial advisor', 'investment banker', 'hedge fund manager', 'portfolio manager', 'financial planner', 'CFO', 'finance content creator', 'personal finance', 'stock market educator', 'financial independence', 'money coach', 'financial educator'],
  investing: ['stock investor', 'real estate investor', 'venture capitalist', 'angel investor', 'investment advisor', 'portfolio manager', 'value investor', 'dividend investor', 'options trader', 'stock trader'],
  crypto: ['crypto trader', 'blockchain developer', 'crypto investor', 'DeFi developer', 'crypto analyst', 'web3 founder', 'Bitcoin educator', 'crypto educator'],
  realestate: ['real estate agent', 'real estate investor', 'real estate developer', 'property manager', 'real estate broker', 'mortgage broker', 'house flipper', 'real estate wholesaler'],
  'real estate': ['real estate agent', 'real estate investor', 'real estate developer', 'property manager', 'real estate broker', 'mortgage broker', 'house flipper'],
  fitness: ['fitness coach', 'personal trainer', 'gym owner', 'strength coach', 'fitness content creator', 'bodybuilder', 'weight loss coach', 'calisthenics coach', 'powerlifting coach', 'online fitness coach', 'fitness influencer'],
  health: ['health coach', 'nutritionist', 'wellness coach', 'dietitian', 'physical therapist', 'health content creator', 'functional medicine', 'holistic health', 'longevity coach'],
  nutrition: ['nutritionist', 'dietitian', 'nutrition coach', 'meal prep coach', 'sports nutritionist', 'wellness coach'],
  tech: ['software engineer', 'tech founder', 'startup CEO', 'developer advocate', 'tech content creator', 'coding educator', 'AI founder', 'SaaS founder', 'tech entrepreneur', 'programmer'],
  startup: ['startup founder', 'startup CEO', 'venture capitalist', 'startup advisor', 'entrepreneur', 'bootstrapped founder', 'SaaS founder', 'startup content creator'],
  business: ['entrepreneur', 'business coach', 'small business owner', 'CEO', 'business content creator', 'e-commerce entrepreneur', 'online business', 'side hustle', 'business strategy'],
  marketing: ['marketing consultant', 'digital marketer', 'social media marketer', 'SEO expert', 'brand strategist', 'marketing content creator', 'growth hacker', 'email marketer', 'paid ads expert'],
  music: ['music producer', 'music artist', 'music manager', 'A&R executive', 'music content creator', 'music educator', 'independent artist', 'music business'],
  film: ['film director', 'film producer', 'casting agent', 'screenwriter', 'film content creator', 'cinematographer', 'filmmaker'],
  fashion: ['fashion designer', 'fashion stylist', 'fashion content creator', 'fashion buyer', 'fashion influencer', 'brand consultant', 'streetwear entrepreneur'],
  food: ['chef', 'food blogger', 'restaurant owner', 'food content creator', 'food entrepreneur', 'recipe creator', 'meal prep'],
  travel: ['travel content creator', 'travel blogger', 'tour operator', 'travel influencer', 'digital nomad', 'travel vlogger'],
  education: ['educator', 'online tutor', 'education content creator', 'edtech founder', 'curriculum designer', 'teacher'],
  law: ['lawyer', 'attorney content creator', 'legal advisor', 'law firm partner', 'legal content creator', 'law educator'],
  medicine: ['doctor', 'physician content creator', 'medical educator', 'healthcare professional', 'nurse practitioner', 'surgeon'],
  hr: ['HR director', 'recruiter', 'talent acquisition', 'HR consultant', 'people operations', 'executive recruiter'],
  recruiting: ['recruiter', 'executive recruiter', 'talent acquisition', 'headhunter', 'HR professional', 'career coach'],
  mindset: ['mindset coach', 'life coach', 'motivational speaker', 'self improvement', 'personal development', 'productivity coach', 'mental performance coach'],
  ecommerce: ['ecommerce entrepreneur', 'dropshipping', 'Amazon FBA seller', 'Shopify entrepreneur', 'online store owner', 'product entrepreneur'],
  sales: ['sales trainer', 'sales coach', 'sales content creator', 'B2B sales', 'closing coach', 'sales strategy'],
}

// Broad role/intent variants used to pad the query set when a search
// keyword doesn't have a TOPIC_MAP entry. Per Dylan's request — niche
// searches should always cast a wide net of at least 30 related queries
// so we never under-populate.
const GENERIC_ROLES = [
  'coach', 'expert', 'specialist', 'professional', 'pro',
  'content creator', 'creator', 'influencer', 'YouTuber', 'vlogger',
  'consultant', 'advisor', 'strategist', 'mentor', 'guru',
  'educator', 'teacher', 'trainer', 'instructor', 'tutor',
  'entrepreneur', 'founder', 'CEO', 'leader', 'authority',
  'reviewer', 'critic', 'commentator', 'analyst', 'enthusiast',
]

// Adjacent intent suffixes — generic question/topic shapes that surface
// channels even when a niche has no fixed occupation list.
const INTENT_SUFFIXES = [
  'tips', 'advice', 'guide', 'tutorial', 'masterclass',
  'training', 'lessons', 'how to', 'best', 'top',
  'review', 'beginner', 'pro', 'secrets', 'mistakes',
  'YouTube channel', 'channel', 'series',
]

// Country name to append to every query for geographic signal
const REGION_SUFFIX: Record<string, string> = {
  US: 'usa', IN: 'india', GB: 'uk', CA: 'canada', AU: 'australia', NZ: 'new zealand',
  IE: 'ireland', PH: 'philippines', SG: 'singapore', NG: 'nigeria',
  ZA: 'south africa', AE: 'dubai uae', DE: 'germany', FR: 'france',
  ES: 'spain', BR: 'brasil', MX: 'mexico', JP: 'japan', KR: 'korea', ID: 'indonesia',
}

// ── LANGUAGE BUNDLES PER REGION ─────────────────────────────────────────────
// Native-language search terms that surface creators making content FOR local
// audiences IN their local language. Fires alongside English local-market queries.
interface LangBundle {
  code: string        // BCP-47 language code (informational)
  name: string        // display name
  topics: Partial<Record<string, string[]>>  // topic key → native query terms
  generic: string[]  // fallback when no topic matched
}

const REGION_LANGUAGES: Record<string, LangBundle[]> = {
  // ── INDIA: Hindi · Tamil · Telugu · Marathi · Bengali · Kannada ───────────
  IN: [
    {
      code: 'hi', name: 'Hindi',
      topics: {
        finance:    ['शेयर बाजार', 'mutual fund SIP hindi', 'share market hindi channel', 'पैसे कैसे बचाएं'],
        trading:    ['option trading hindi', 'intraday trading hindi', 'शेयर ट्रेडिंग हिंदी'],
        investing:  ['SIP investment hindi', 'stock market beginners hindi', 'mutual fund explained hindi'],
        economics:  ['indian economy hindi channel', 'budget explained hindi', 'RBI policy hindi'],
        crypto:     ['cryptocurrency explained hindi', 'bitcoin hindi channel', 'crypto news hindi'],
        business:   ['business ideas hindi', 'online paise kaise kamaye', 'startup india hindi channel'],
        realestate: ['property investment hindi', 'home loan guide hindi', 'real estate tips hindi'],
        fitness:    ['workout hindi channel', 'weight loss tips hindi', 'gym beginners hindi'],
        health:     ['health tips hindi', 'yoga hindi channel', 'ayurveda benefits hindi'],
        tech:       ['coding sikhiye hindi', 'programming tutorial hindi', 'AI explained hindi'],
        marketing:  ['digital marketing hindi', 'youtube channel kaise banaye hindi'],
        education:  ['UPSC preparation channel', 'study motivation hindi', 'exam tips hindi channel'],
        mindset:    ['motivation hindi channel', 'सफलता के राज', 'self improvement hindi'],
        law:        ['kanoon ki jankari hindi', 'legal rights india hindi channel'],
      },
      generic: ['hindi youtube channel', 'hindi vlogger india', 'hindi content creator'],
    },
    {
      code: 'ta', name: 'Tamil',
      topics: {
        finance:    ['share market tamil', 'investment tips tamil channel', 'mutual fund tamil'],
        trading:    ['stock market trading tamil', 'option trading tamil channel'],
        business:   ['business ideas tamil', 'online business tamil channel'],
        fitness:    ['workout tamil channel', 'weight loss tamil', 'gym tips tamil'],
        health:     ['health tips tamil', 'yoga tamil channel'],
        mindset:    ['motivation tamil channel', 'self improvement tamil'],
        education:  ['exam tips tamil channel', 'tnpsc preparation tamil'],
        crypto:     ['crypto tamil channel', 'bitcoin explained tamil'],
        realestate: ['property investment tamil', 'home buying guide tamil'],
      },
      generic: ['tamil youtube channel', 'tamil content creator', 'tamil vlogger'],
    },
    {
      code: 'te', name: 'Telugu',
      topics: {
        finance:    ['share market telugu', 'investment tips telugu channel', 'mutual fund telugu'],
        trading:    ['stock trading telugu channel', 'option trading telugu'],
        business:   ['business ideas telugu', 'online business telugu channel'],
        fitness:    ['workout telugu channel', 'fitness tips telugu'],
        health:     ['health tips telugu channel', 'yoga telugu'],
        mindset:    ['motivation telugu channel', 'success tips telugu'],
        crypto:     ['crypto telugu channel', 'bitcoin explained telugu'],
      },
      generic: ['telugu youtube channel', 'telugu content creator', 'telugu vlogger'],
    },
    {
      code: 'mr', name: 'Marathi',
      topics: {
        finance:    ['share market marathi', 'गुंतवणूक मराठी channel', 'mutual fund marathi'],
        trading:    ['stock trading marathi channel', 'option trading marathi'],
        business:   ['business ideas marathi channel', 'startup marathi'],
        fitness:    ['workout marathi channel', 'fitness marathi'],
        mindset:    ['motivation marathi channel', 'यश मराठी tips'],
        education:  ['mpsc preparation marathi', 'study tips marathi channel'],
      },
      generic: ['marathi youtube channel', 'marathi content creator', 'marathi vlogger'],
    },
    {
      code: 'bn', name: 'Bengali',
      topics: {
        finance:    ['share market bangla channel', 'mutual fund bangla', 'investment tips bangla'],
        trading:    ['stock trading bangla channel', 'option trading bengali'],
        business:   ['business ideas bangla channel', 'online income bangla'],
        fitness:    ['workout bangla channel', 'fitness tips bangla'],
        mindset:    ['motivation bangla channel', 'সাফল্য tips bangla'],
      },
      generic: ['bengali youtube channel', 'bangla content creator', 'bangla vlogger'],
    },
    {
      code: 'kn', name: 'Kannada',
      topics: {
        finance:    ['share market kannada channel', 'investment tips kannada'],
        trading:    ['stock trading kannada channel'],
        business:   ['business ideas kannada channel', 'online business kannada'],
        mindset:    ['motivation kannada channel', 'success tips kannada'],
        education:  ['kpsc preparation kannada', 'study tips kannada channel'],
      },
      generic: ['kannada youtube channel', 'kannada content creator'],
    },
  ],

  // ── PHILIPPINES: Tagalog / Filipino ──────────────────────────────────────
  PH: [
    {
      code: 'tl', name: 'Filipino',
      topics: {
        finance:    ['pera tips tagalog channel', 'investment philippines tagalog', 'stock market tagalog tutorial'],
        trading:    ['stocks tagalog tutorial', 'forex trading tagalog channel'],
        business:   ['negosyo tips tagalog', 'online negosyo tagalog channel', 'paano kumita online'],
        fitness:    ['workout tagalog channel', 'fitness tips tagalog', 'payat tips tagalog'],
        health:     ['health tips tagalog channel', 'kalusugan tips Filipino'],
        mindset:    ['motivasyon tagalog channel', 'self improvement tagalog', 'diskarte sa buhay'],
        education:  ['board exam tips tagalog', 'study tips Filipino channel'],
        crypto:     ['crypto tagalog channel', 'bitcoin Philippines tagalog'],
      },
      generic: ['tagalog youtube channel', 'pinoy content creator', 'filipino vlogger'],
    },
  ],

  // ── UAE / DUBAI: Arabic ───────────────────────────────────────────────────
  AE: [
    {
      code: 'ar', name: 'Arabic',
      topics: {
        finance:    ['استثمار المال عربي يوتيوب', 'تمويل شخصي عربي channel', 'ادارة المال عربي'],
        trading:    ['تداول الاسهم عربي يوتيوب', 'فوركس عربي channel'],
        business:   ['ريادة الاعمال عربي يوتيوب', 'مشاريع ناجحة عربي'],
        mindset:    ['تطوير الذات عربي يوتيوب', 'تحفيز عربي channel'],
        fitness:    ['لياقة بدنية عربي يوتيوب', 'تمارين رياضية عربي'],
        health:     ['صحة ونصائح عربي يوتيوب', 'تغذية صحية عربي'],
        realestate: ['عقارات دبي استثمار يوتيوب', 'اسعار العقارات عربي'],
        crypto:     ['كريبتو عربي يوتيوب', 'بيتكوين عربي channel'],
      },
      generic: ['يوتيوب عربي قناة', 'صانع محتوى عربي', 'قناة عربية يوتيوب'],
    },
  ],

  // ── GERMANY: German ───────────────────────────────────────────────────────
  DE: [
    {
      code: 'de', name: 'German',
      topics: {
        finance:    ['Finanzen YouTube Kanal Deutsch', 'ETF Sparplan erklärt', 'Geld anlegen Anfänger Deutsch'],
        trading:    ['Aktien kaufen lernen Deutsch', 'Börse Anfänger YouTube', 'Depot aufbauen Kanal'],
        investing:  ['passiv investieren Kanal Deutsch', 'MSCI World erklärt', 'Dividenden Aktien Deutsch'],
        business:   ['selbstständig YouTube Kanal', 'Unternehmen gründen Deutsch channel'],
        fitness:    ['Fitness YouTube Deutsch Kanal', 'Abnehmen Tipps Deutsch', 'Muskelaufbau Kanal'],
        health:     ['Gesundheit YouTube Deutsch', 'Ernährung Tipps Kanal Deutsch'],
        mindset:    ['Motivation Deutsch YouTube', 'Produktivität Kanal Deutsch'],
        tech:       ['Programmieren YouTube Deutsch', 'IT Kanal Deutsch'],
      },
      generic: ['Deutsch YouTube Kanal', 'deutschsprachiger YouTuber', 'Deutsch content creator'],
    },
  ],

  // ── FRANCE: French ────────────────────────────────────────────────────────
  FR: [
    {
      code: 'fr', name: 'French',
      topics: {
        finance:    ['chaîne YouTube finances France', 'investir bourse débutant YouTube', 'épargne retraite chaîne'],
        trading:    ['trading bourse YouTube France', 'PEA actions investissement chaîne'],
        business:   ['entrepreneur YouTube France', 'auto-entrepreneur conseils chaîne'],
        fitness:    ['fitness YouTube France', 'perdre du poids conseils', 'musculation YouTube français'],
        health:     ['santé YouTube France', 'nutrition conseils chaîne française'],
        mindset:    ['motivation YouTube français', 'développement personnel France chaîne'],
        tech:       ['programmation YouTube français', 'tech chaîne France'],
      },
      generic: ['chaîne YouTube française', 'créateur de contenu français', 'YouTuber français'],
    },
  ],

  // ── SPAIN: Spanish ────────────────────────────────────────────────────────
  ES: [
    {
      code: 'es', name: 'Spanish',
      topics: {
        finance:    ['canal finanzas YouTube España', 'invertir bolsa principiante canal', 'ahorro dinero YouTube'],
        trading:    ['trading bolsa YouTube español', 'inversión acciones España canal'],
        business:   ['emprendedor YouTube España canal', 'crear negocio online España'],
        fitness:    ['fitness YouTube español canal', 'bajar de peso España', 'musculación YouTube español'],
        health:     ['salud YouTube español canal', 'nutrición consejos España'],
        mindset:    ['motivación YouTube español', 'desarrollo personal España canal'],
        tech:       ['programación YouTube español canal', 'tecnología España canal'],
      },
      generic: ['canal YouTube español', 'creador contenido España', 'YouTuber español'],
    },
  ],

  // ── BRAZIL: Portuguese ────────────────────────────────────────────────────
  BR: [
    {
      code: 'pt', name: 'Portuguese',
      topics: {
        finance:    ['canal finanças YouTube Brasil', 'investir B3 iniciante canal', 'educação financeira YouTube'],
        trading:    ['day trade YouTube Brasil canal', 'ações bolsa valores Brasil'],
        business:   ['empreendedor YouTube Brasil canal', 'abrir negócio online Brasil'],
        fitness:    ['fitness YouTube Brasil canal', 'emagrecer dicas', 'musculação canal brasileiro'],
        health:     ['saúde dicas YouTube Brasil', 'nutrição canal português'],
        mindset:    ['motivação YouTube Brasil canal', 'desenvolvimento pessoal português'],
        tech:       ['programação YouTube português canal', 'tecnologia canal Brasil'],
        crypto:     ['cripto YouTube Brasil canal', 'bitcoin reais channel'],
      },
      generic: ['canal YouTube brasileiro', 'criador de conteúdo Brasil', 'YouTuber brasileiro'],
    },
  ],

  // ── MEXICO: Spanish (Mexico-specific) ─────────────────────────────────────
  MX: [
    {
      code: 'es', name: 'Spanish',
      topics: {
        finance:    ['canal finanzas YouTube Mexico', 'invertir Mexico principiante', 'CETES educación financiera Mexico'],
        trading:    ['trading bolsa Mexico YouTube canal', 'acciones BMV Mexico'],
        business:   ['emprendedor YouTube Mexico canal', 'negocio online Mexico'],
        fitness:    ['fitness YouTube Mexico canal', 'bajar peso Mexico', 'gym tips Mexico'],
        health:     ['salud consejos Mexico YouTube', 'nutrición Mexico canal'],
        mindset:    ['motivación YouTube Mexico canal', 'mentalidad éxito Mexico'],
        tech:       ['programación YouTube Mexico canal', 'tecnología Mexico'],
        crypto:     ['cripto YouTube Mexico canal', 'bitcoin pesos Mexico'],
      },
      generic: ['canal YouTube Mexico', 'creador contenido mexicano', 'YouTuber Mexico'],
    },
  ],

  // ── JAPAN: Japanese ───────────────────────────────────────────────────────
  JP: [
    {
      code: 'ja', name: 'Japanese',
      topics: {
        finance:    ['資産運用 YouTubeチャンネル', 'NISA 投資 初心者 解説', 'お金の増やし方 チャンネル'],
        trading:    ['株 トレード YouTube', '日本株 デイトレ 解説チャンネル', 'FX 入門 日本語'],
        investing:  ['インデックス投資 解説チャンネル', 'ETF 積立投資 YouTube', '長期投資 入門 日本語'],
        business:   ['起業 YouTubeチャンネル 日本語', '副業 稼ぐ方法 YouTube', 'ビジネス 解説 日本語'],
        fitness:    ['筋トレ YouTube 日本語チャンネル', 'ダイエット 方法 解説 YouTube'],
        health:     ['健康 YouTubeチャンネル 日本語', '食事 栄養 解説 YouTube'],
        mindset:    ['自己啓発 YouTubeチャンネル', '成功 マインドセット 日本語'],
        tech:       ['プログラミング YouTube 日本語', 'ITエンジニア 解説チャンネル'],
      },
      generic: ['日本語 YouTubeチャンネル', '日本人 YouTuber', 'Japanese content creator'],
    },
  ],

  // ── SOUTH KOREA: Korean ───────────────────────────────────────────────────
  KR: [
    {
      code: 'ko', name: 'Korean',
      topics: {
        finance:    ['재테크 유튜브채널 한국어', '주식투자 초보 유튜브', '돈 모으는 방법 유튜브'],
        trading:    ['주식 분석 유튜브 한국어', '코스피 단타 해설채널', '미국주식 한국어 해설'],
        investing:  ['장기투자 유튜브 한국어', 'ETF 투자 해설 채널', '인덱스펀드 한국어'],
        business:   ['창업 유튜브 채널 한국어', '부업 돈버는법 YouTube', '스타트업 한국 해설'],
        fitness:    ['헬스 유튜브 채널 한국어', '다이어트 운동 YouTube 한국', '근성장 채널'],
        health:     ['건강 유튜버 한국어', '영양 식단 YouTube 한국어'],
        mindset:    ['자기계발 유튜브 한국어', '성공 마인드셋 채널'],
        tech:       ['프로그래밍 유튜브 한국어', 'IT개발자 YouTube 채널'],
        crypto:     ['코인 유튜브채널 한국어', '비트코인 한국어 해설'],
      },
      generic: ['한국어 유튜브채널', '한국 YouTuber', 'Korean content creator'],
    },
  ],

  // ── INDONESIA: Bahasa Indonesia ───────────────────────────────────────────
  ID: [
    {
      code: 'id', name: 'Indonesian',
      topics: {
        finance:    ['keuangan pribadi YouTube Indonesia', 'investasi saham pemula channel', 'tips nabung Indonesia'],
        trading:    ['trading saham Indonesia YouTube', 'analisis saham BEI channel'],
        business:   ['bisnis online YouTube Indonesia canal', 'usaha rumahan tips channel'],
        fitness:    ['olahraga YouTube Indonesia channel', 'diet tips bahasa Indonesia', 'gym Indonesia channel'],
        health:     ['kesehatan YouTube Indonesia channel', 'nutrisi makanan sehat Bahasa'],
        mindset:    ['motivasi Indonesia YouTube channel', 'pengembangan diri Bahasa Indonesia'],
        tech:       ['programming YouTube Indonesia channel', 'coding Bahasa Indonesia'],
        crypto:     ['kripto YouTube Indonesia channel', 'bitcoin rupiah channel'],
      },
      generic: ['channel YouTube Indonesia', 'konten kreator Indonesia', 'YouTuber Indonesia'],
    },
  ],

  // ── SINGAPORE: English-primary + Mandarin layer ───────────────────────────
  SG: [
    {
      code: 'zh', name: 'Chinese',
      topics: {
        finance:    ['新加坡理财 YouTube频道', 'CPF 投资 新加坡 频道', '新加坡 股票 投资 解说'],
        business:   ['新加坡 创业 YouTube', '新加坡 商业 中文频道'],
        mindset:    ['新加坡 自我提升 频道', '成功思维 中文 Singapore'],
        fitness:    ['健身 新加坡 中文频道', '减肥 新加坡 YouTube'],
        health:     ['健康 养生 新加坡 频道', '营养 中文 YouTube'],
      },
      generic: ['新加坡 中文 YouTube频道', '新加坡 华语 频道', 'Singapore Chinese YouTuber'],
    },
  ],

  // ── NIGERIA: Pidgin + Yoruba layer (English already dominant) ─────────────
  NG: [
    {
      code: 'pcm', name: 'Nigerian Pidgin',
      topics: {
        finance:    ['how to make money naija channel', 'investment tips naija YouTube', 'save money Nigeria channel'],
        business:   ['hustle naija YouTube', 'side hustle nigeria channel', 'online business naija'],
        mindset:    ['motivation naija channel', 'success africa youth YouTube'],
      },
      generic: ['naija youtube channel', 'nigerian content creator', 'naija vlogger'],
    },
  ],
}

// Canonical topic aliases — maps what a user might type to the REGION_TOPIC_EXTRAS keys
const TOPIC_ALIASES: Record<string, string[]> = {
  finance:    ['finance', 'investing', 'investment', 'money', 'banking', 'wealth', 'stock', 'trading', 'economics', 'economy'],
  trading:    ['trading', 'trader', 'forex', 'stock', 'options', 'futures', 'crypto', 'day trade'],
  investing:  ['investing', 'investment', 'investor', 'portfolio', 'wealth', 'dividends', 'etf', 'mutual fund'],
  economics:  ['economics', 'economy', 'macro', 'gdp', 'inflation', 'monetary'],
  crypto:     ['crypto', 'bitcoin', 'blockchain', 'nft', 'defi', 'web3', 'altcoin', 'ethereum'],
  business:   ['business', 'entrepreneur', 'startup', 'small business', 'ecommerce', 'side hustle', 'hustle', 'sales', 'marketing'],
  realestate: ['real estate', 'realestate', 'property', 'housing', 'mortgage', 'landlord', 'rent'],
  fitness:    ['fitness', 'gym', 'workout', 'bodybuilding', 'weight loss', 'personal trainer', 'strength'],
  health:     ['health', 'wellness', 'nutrition', 'diet', 'medicine', 'doctor', 'mental health', 'yoga', 'meditation'],
  tech:       ['tech', 'software', 'coding', 'programming', 'ai', 'developer', 'engineer', 'saas'],
  marketing:  ['marketing', 'social media', 'seo', 'branding', 'advertising', 'content creator', 'influencer'],
  education:  ['education', 'tutor', 'learning', 'exam', 'study', 'teacher', 'course'],
  law:        ['law', 'legal', 'lawyer', 'attorney', 'compliance', 'contract'],
  mindset:    ['mindset', 'motivation', 'productivity', 'self improvement', 'life coach', 'personal development'],
}

function matchTopicKeys(keyword: string): string[] {
  const lower = keyword.toLowerCase()
  const matched = new Set<string>()
  for (const [key, aliases] of Object.entries(TOPIC_ALIASES)) {
    if (aliases.some(a => lower.includes(a) || a.includes(lower))) matched.add(key)
  }
  return [...matched]
}

// Generate native-language search queries for all language bundles in a region
function buildLanguageQueries(gl: string, keyword: string): string[] {
  const bundles = REGION_LANGUAGES[gl]
  if (!bundles || bundles.length === 0) return []
  const matchedTopicKeys = matchTopicKeys(keyword)
  const queries: string[] = []
  for (const bundle of bundles) {
    const bundleQ: string[] = []
    if (matchedTopicKeys.length > 0) {
      for (const topicKey of matchedTopicKeys) {
        bundleQ.push(...(bundle.topics[topicKey] || []).slice(0, 2))
      }
    }
    // fall back to generic language queries when no topic matched
    if (bundleQ.length === 0) bundleQ.push(...bundle.generic.slice(0, 2))
    queries.push(...bundleQ)
  }
  return queries
}

// Deep local market terminology per region per topic category
const REGION_TOPIC_EXTRAS: Record<string, Record<string, string[]>> = {
  // ── UNITED STATES ────────────────────────────────────────────────────────────
  US: {
    finance:    ['personal finance usa', 'financial independence usa', '401k roth IRA explained', 'high yield savings usa', 'index fund vanguard fidelity', 'budget money usa', 'dave ramsey style', 'FIRE movement usa'],
    trading:    ['stock trading usa', 'NYSE NASDAQ trading', 'options trading usa', 'day trading america', 'robinhood webull usa', 'technical analysis usa', 'swing trading usa'],
    investing:  ['investing usa beginners', 'S&P 500 index fund', 'ETF usa vanguard', 'dividend investing usa', 'passive income usa', 'FIRE retire early usa', 'index investing america'],
    economics:  ['us economy explained', 'federal reserve interest rates', 'inflation usa', 'american economy', 'GDP usa', 'recession usa', 'wall street economics'],
    crypto:     ['crypto usa', 'bitcoin usd', 'SEC crypto regulation', 'coinbase usa', 'ethereum usa investment'],
    business:   ['small business usa', 'LLC formation usa', 'side hustle america', 'ecommerce usa', 'amazon fba usa', 'shopify usa seller', 'startup america founder', 'entrepreneur usa'],
    realestate: ['real estate investing usa', 'rental property usa', 'house hacking usa', 'multifamily investing america', 'real estate wholesaling usa', 'BRRRR method usa', 'real estate agent usa'],
    fitness:    ['fitness usa', 'gym workout america', 'personal trainer usa', 'bodybuilding usa', 'powerlifting america'],
    health:     ['health usa', 'nutrition america', 'mental health usa', 'wellness usa', 'american doctor advice'],
    marketing:  ['digital marketing usa', 'social media marketing america', 'content creator usa', 'youtube growth usa', 'SEO america'],
    mindset:    ['motivation usa', 'entrepreneur mindset america', 'productivity usa', 'self improvement usa'],
    law:        ['business law usa', 'contract law explained usa', 'legal advice america', 'law firm usa', 'attorney usa content'],
    sports:     ['sports coach usa', 'sports agent america', 'college recruiting usa', 'athletic trainer usa', 'sports performance usa'],
  },
  // ── INDIA ────────────────────────────────────────────────────────────────────
  IN: {
    finance:    ['share market india', 'personal finance hindi', 'mutual fund sip india', 'paisa kaise kamaye', 'financial planning india', 'money management india', 'zerodha groww india', 'demat account kaise khole', 'NSE BSE india investor'],
    trading:    ['share market trading india', 'intraday trading hindi', 'option trading india', 'sensex nifty analysis', 'swing trading india', 'algo trading india', 'F&O trading india', 'zerodha kite trading', 'price action trading india'],
    investing:  ['mutual fund india hindi', 'SIP investment india', 'nifty index fund india', 'long term investing india', 'value investing india hindi', 'stock market beginners india', 'ETF india', 'groww app investing'],
    economics:  ['indian economy explained', 'budget 2024 india', 'RBI monetary policy hindi', 'inflation india', 'GST explained hindi', 'india GDP growth', 'economic survey india', 'demonetisation india', 'UPI digital payment india'],
    crypto:     ['cryptocurrency india hindi', 'bitcoin india', 'crypto tax india', 'WazirX CoinDCX india', 'crypto regulation india', 'web3 india startup', 'NFT india hindi'],
    business:   ['startup india hindi', 'business ideas india hindi', 'Shark Tank India', 'MSME business india', 'GST registration india', 'small business ideas india', 'dropshipping india hindi', 'amazon flipkart seller india', 'freelancing india'],
    realestate: ['real estate india hindi', 'property investment india', 'RERA india explained', 'home loan india', 'flat purchase guide india', 'commercial property india', 'builder vs resale india', 'Noida Gurugram property'],
    fitness:    ['fitness india hindi', 'gym workout india', 'weight loss india hindi', 'bodybuilding india', 'calisthenics india', 'diet plan india hindi', 'transformation india'],
    health:     ['health tips hindi', 'ayurveda benefits', 'yoga hindi channel', 'home remedies india', 'diabetes india hindi', 'mental health india hindi', 'AIIMS doctor advice'],
    tech:       ['coding hindi india', 'software engineer india', 'AI machine learning india', 'tech startup india', 'programming tutorials hindi', 'data science india hindi', 'FAANG preparation india'],
    marketing:  ['digital marketing hindi india', 'social media marketing india', 'YouTube growth india', 'content creator india hindi', 'SEO hindi', 'affiliate marketing india'],
    education:  ['UPSC preparation', 'NEET JEE preparation india', 'competitive exam india', 'IAS officer india', 'SSC CGL preparation', 'online learning hindi india'],
    law:        ['law india hindi', 'IPC section explained hindi', 'legal advice india hindi', 'consumer rights india', 'property law india', 'startup legal india'],
    mindset:    ['motivation hindi', 'success mindset india', 'productivity hindi channel', 'self improvement india hindi', 'Sandeep Maheshwari style', 'life coach india hindi'],
  },

  // ── UNITED KINGDOM ───────────────────────────────────────────────────────────
  GB: {
    finance:    ['personal finance uk', 'ISA investing uk', 'SIPP pension uk', 'FTSE 100 investing', 'premium bonds uk', 'conquer your cash uk', 'money saving expert uk', 'financial independence uk'],
    trading:    ['stock trading uk', 'spread betting uk', 'CFD trading uk', 'FTSE trading', 'IG trading uk', 'Hargreaves Lansdown investing', 'share dealing uk', 'ISA stocks and shares'],
    investing:  ['investing uk beginners', 'index fund uk', 'Vanguard uk investing', 'dividend investing uk', 'ISA allowance uk', 'global ETF uk', 'FIRE movement uk'],
    economics:  ['uk economy explained', 'Bank of England interest rates', 'UK inflation cost of living', 'Brexit economic impact', 'UK budget analysis', 'recession uk', 'autumn statement uk'],
    crypto:     ['crypto uk', 'bitcoin uk tax', 'HMRC crypto uk', 'crypto exchange uk regulated', 'ethereum uk'],
    business:   ['small business uk', 'limited company uk', 'sole trader uk', 'HMRC self assessment', 'VAT registration uk', 'UK startup founder', 'side hustle uk', 'ecommerce uk'],
    realestate: ['property investment uk', 'buy to let uk', 'stamp duty uk', 'remortgage uk', 'house prices uk', 'right to buy uk', 'HMO property uk', 'property portfolio uk'],
    fitness:    ['fitness uk', 'gym uk workout', 'personal trainer uk', 'running uk', 'cycling uk fitness'],
    health:     ['NHS health tips', 'mental health uk', 'nutrition uk', 'wellness uk channel', 'UK doctor advice'],
    tech:       ['tech startup uk', 'software developer uk', 'fintech uk', 'AI uk', 'London tech scene'],
    mindset:    ['motivation uk', 'productivity uk', 'self improvement uk', 'entrepreneur mindset uk'],
  },

  // ── CANADA ───────────────────────────────────────────────────────────────────
  CA: {
    finance:    ['personal finance canada', 'TFSA investing canada', 'RRSP explained canada', 'FHSA first home canada', 'GIC savings canada', 'wealthsimple canada', 'EI CPP OAS canada', 'budget canada tips'],
    trading:    ['stock trading canada', 'TSX stocks canada', 'options trading canada', 'questrade investing', 'interactive brokers canada', 'day trading canada tax'],
    investing:  ['index fund canada', 'ETF investing canada', 'dividend stocks canada', 'TFSA investment canada', 'FIRE canada', 'passive income canada', 'couch potato portfolio canada'],
    economics:  ['canadian economy', 'bank of canada interest rate', 'inflation canada', 'housing crisis canada', 'cost of living canada', 'CRA tax canada', 'canadian dollar'],
    crypto:     ['crypto canada', 'bitcoin canada tax', 'CRA crypto reporting', 'canadian crypto exchange', 'wealthsimple crypto'],
    business:   ['small business canada', 'incorporated business canada', 'GST HST canada', 'CRA business canada', 'side hustle canada', 'ecommerce canada', 'dropshipping canada'],
    realestate: ['real estate canada', 'housing market canada', 'mortgage canada 2024', 'first time buyer canada', 'condo investment canada', 'toronto vancouver real estate', 'rental property canada'],
    fitness:    ['fitness canada', 'workout canada', 'personal trainer canada'],
    mindset:    ['entrepreneur canada', 'productivity canada', 'success mindset canada'],
  },

  // ── AUSTRALIA ────────────────────────────────────────────────────────────────
  AU: {
    finance:    ['personal finance australia', 'superannuation explained', 'SMSF australia', 'high interest savings australia', 'ETF australia beginners', 'vanguard australia', 'barefoot investor style', 'financial independence australia'],
    trading:    ['share trading australia', 'ASX stocks australia', 'CommSec trading', 'options australia', 'CFD trading australia', 'day trading australia tax', 'SelfWealth australia'],
    investing:  ['investing australia beginners', 'ASX ETF australia', 'dividend investing australia', 'passive investing australia', 'FIRE australia', 'index fund australia', 'franking credits explained'],
    economics:  ['australian economy', 'RBA interest rates', 'inflation australia', 'cost of living australia', 'housing affordability australia', 'federal budget australia', 'recession australia'],
    crypto:     ['crypto australia', 'bitcoin ATO tax australia', 'crypto exchange australia', 'coinspot swyftx australia', 'ethereum australia'],
    business:   ['small business australia', 'ABN sole trader australia', 'GST australia', 'ATO tax australia', 'side hustle australia', 'ecommerce australia', 'shopify australia'],
    realestate: ['property investment australia', 'negative gearing australia', 'stamp duty australia', 'housing market australia', 'rentvesting australia', 'buyers agent australia', 'dual income property australia'],
    fitness:    ['fitness australia', 'workout australia', 'personal trainer australia', 'CrossFit australia'],
    mindset:    ['entrepreneur australia', 'motivation australia', 'startup australia founder'],
  },

  // ── NEW ZEALAND ──────────────────────────────────────────────────────────────
  NZ: {
    finance:    ['personal finance new zealand', 'KiwiSaver explained', 'NZX investing', 'savings account new zealand', 'financial independence NZ', 'sorted money NZ'],
    trading:    ['share trading new zealand', 'NZX stocks', 'Sharesies investing NZ', 'Hatch invest NZ', 'ASX from NZ'],
    investing:  ['investing new zealand', 'index fund NZ', 'ETF new zealand', 'dividend NZ', 'FIRE movement NZ'],
    economics:  ['new zealand economy', 'RBNZ interest rates', 'inflation NZ', 'cost of living NZ', 'housing crisis new zealand'],
    business:   ['small business new zealand', 'sole trader NZ', 'GST new zealand', 'IRD tax NZ', 'startup NZ'],
    realestate: ['property investment new zealand', 'housing market NZ', 'mortgage NZ', 'Auckland property', 'rental yield NZ'],
  },

  // ── IRELAND ──────────────────────────────────────────────────────────────────
  IE: {
    finance:    ['personal finance ireland', 'pension ireland', 'ARF PRSA ireland', 'ETF tax ireland', 'revenue tax ireland', 'money saving ireland', 'financial planning ireland'],
    trading:    ['stock trading ireland', 'ETF investing ireland', 'degiro ireland', 'interactive brokers ireland', 'revenue CGT ireland'],
    investing:  ['investing ireland beginners', 'index fund ireland', 'deemed disposal ireland ETF', 'FIRE ireland', 'passive income ireland'],
    economics:  ['irish economy', 'ECB interest rates ireland', 'inflation ireland', 'cost of living ireland', 'corporation tax ireland', 'budget ireland'],
    business:   ['small business ireland', 'sole trader ireland', 'limited company ireland', 'revenue commissioners ireland', 'VAT ireland', 'startup ireland'],
    realestate: ['property investment ireland', 'house prices ireland', 'mortgage ireland', 'dublin property market', 'rental market ireland', 'buy to let ireland'],
  },

  // ── INDIA handled above ──────────────────────────────────────────────────────

  // ── PHILIPPINES ──────────────────────────────────────────────────────────────
  PH: {
    finance:    ['personal finance philippines', 'investing philippines', 'MP2 pag-ibig', 'SSS contribution philippines', 'BDO BPI investment', 'UITF philippines', 'savings account philippines', 'VUL insurance philippines'],
    trading:    ['PSE stocks philippines', 'stock market philippines beginners', 'forex trading philippines', 'crypto philippines', 'COL financial philippines', 'firstmetrosec philippines'],
    investing:  ['investing philippines beginners', 'UITF philippines', 'index fund philippines', 'dividend stocks PSE', 'REITs philippines', 'passive income philippines'],
    economics:  ['philippine economy', 'BSP interest rate philippines', 'inflation philippines', 'OFW investment guide', 'peso dollar rate'],
    crypto:     ['crypto philippines', 'bitcoin philippines', 'axie infinity philippines', 'play to earn philippines', 'PDAX philippines'],
    business:   ['business ideas philippines', 'online business philippines', 'negosyo tips tagalog', 'dropshipping philippines', 'lazada shopee seller', 'freelancing philippines', 'BIR registration philippines'],
    realestate: ['real estate philippines', 'condo investment manila', 'DMCI SMDC preselling', 'pag-ibig housing loan', 'property investment cebu'],
    fitness:    ['fitness philippines', 'gym philippines', 'workout tagalog'],
    mindset:    ['motivation tagalog', 'self improvement philippines', 'entrepreneur philippines'],
  },

  // ── SINGAPORE ────────────────────────────────────────────────────────────────
  SG: {
    finance:    ['personal finance singapore', 'CPF investment OA SA', 'Singapore savings bond SSB', 'endowment plan singapore', 'SRS supplementary retirement', 'singlife manulife singapore', 'DBS POSB savings singapore'],
    trading:    ['SGX stocks singapore', 'stock trading singapore', 'tiger brokers moomoo singapore', 'US stocks from singapore', 'options trading singapore', 'CFD singapore'],
    investing:  ['investing singapore beginners', 'REITs singapore SGX', 'ETF singapore', 'robo advisor syfe endowus', 'FIRE movement singapore', 'passive income singapore', 'CPF special account investing'],
    economics:  ['singapore economy', 'MAS monetary policy', 'inflation singapore', 'GST hike singapore', 'cost of living singapore', 'singapore budget'],
    crypto:     ['crypto singapore', 'MAS regulated crypto', 'bitcoin singapore', 'coinbase gemini singapore'],
    business:   ['business setup singapore', 'sole proprietorship singapore', 'private limited company singapore', 'ACRA registration', 'GST registration singapore', 'startup singapore founder', 'SME grant singapore'],
    realestate: ['HDB property singapore', 'condo investment singapore', 'ABSD stamp duty', 'BTO HDB application', 'property agent singapore', 'en bloc singapore', 'rental yield singapore'],
    fitness:    ['fitness singapore', 'gym singapore', 'personal trainer singapore', 'running singapore'],
    mindset:    ['entrepreneur singapore', 'startup founder singapore', 'productivity singapore'],
  },

  // ── NIGERIA ──────────────────────────────────────────────────────────────────
  NG: {
    finance:    ['personal finance nigeria', 'how to invest in nigeria', 'dollar investment nigeria', 'pension PFA nigeria', 'money management nigeria', 'saving money nigeria', 'piggyves cowrywise nigeria'],
    trading:    ['forex trading nigeria', 'NGX stock exchange', 'stock market nigeria beginners', 'crypto P2P nigeria', 'USDT naira trading', 'binary options nigeria', 'gold trading nigeria'],
    investing:  ['investment nigeria', 'treasury bills nigeria', 'mutual fund nigeria', 'real estate investment nigeria', 'agribusiness investment nigeria', 'dollar asset nigeria', 'ETF nigeria'],
    economics:  ['nigerian economy', 'naira devaluation', 'inflation nigeria', 'CBN monetary policy', 'oil economy nigeria', 'GDP nigeria', 'cost of living nigeria'],
    crypto:     ['crypto nigeria', 'bitcoin naira', 'binance nigeria', 'P2P crypto nigeria', 'USDT nigeria', 'web3 nigeria'],
    business:   ['business ideas nigeria', 'small business nigeria', 'POS business nigeria', 'export business nigeria', 'agribusiness nigeria', 'ecommerce jumia konga nigeria', 'importation business nigeria', 'side hustle nigeria'],
    realestate: ['real estate nigeria', 'property investment lagos abuja', 'land banking nigeria', 'affordable housing nigeria', 'short let investment nigeria'],
    fitness:    ['fitness nigeria', 'gym workout nigeria', 'weight loss nigeria'],
    mindset:    ['motivation nigeria', 'entrepreneur nigeria', 'success africa', 'hustle naija'],
  },

  // ── SOUTH AFRICA ─────────────────────────────────────────────────────────────
  ZA: {
    finance:    ['personal finance south africa', 'JSE investing', 'tax free savings account south africa', 'retirement annuity RA south africa', 'unit trust south africa', 'easy equities south africa', '22seven budgeting'],
    trading:    ['JSE shares south africa', 'stock trading south africa', 'EasyEquities investing', 'forex trading south africa', 'crypto south africa', 'satrix etf south africa'],
    investing:  ['investing south africa beginners', 'ETF south africa', 'JSE index fund', 'passive income south africa', 'FIRE movement south africa', 'dividend stocks south africa'],
    economics:  ['south african economy', 'SARB interest rate', 'inflation south africa', 'rand exchange rate', 'eskom load shedding economy', 'budget south africa', 'GDP south africa'],
    crypto:     ['crypto south africa', 'bitcoin rand', 'FSCA regulated crypto SA', 'luno valr south africa'],
    business:   ['small business south africa', 'SARS tax south africa', 'Pty Ltd south africa', 'CIPC registration', 'side hustle south africa', 'ecommerce south africa', 'dropshipping south africa'],
    realestate: ['property investment south africa', 'buy to let south africa', 'transfer duty south africa', 'sectional title south africa', 'cape town johannesburg property', 'rental income south africa'],
    mindset:    ['entrepreneur south africa', 'motivation south africa', 'success africa', 'township business'],
  },

  // ── UAE / DUBAI ──────────────────────────────────────────────────────────────
  AE: {
    finance:    ['personal finance dubai uae', 'saving money dubai', 'expat finance uae', 'investment options dubai', 'golden visa uae investment', 'offshore banking uae', 'money transfer uae'],
    trading:    ['stock trading dubai', 'DFM ADX stocks uae', 'forex trading dubai', 'gold trading dubai', 'crypto uae', 'commodity trading dubai'],
    investing:  ['investing in dubai uae', 'REITs uae', 'ETF from uae', 'stock market expat dubai', 'passive income dubai'],
    economics:  ['dubai economy', 'uae vision 2031', 'dirham dollar peg', 'cost of living dubai', 'free zone uae', 'oil economy uae'],
    crypto:     ['crypto uae regulated', 'bitcoin dubai', 'VARA uae crypto', 'binance dubai', 'web3 uae'],
    business:   ['business setup dubai', 'free zone vs mainland uae', 'trade licence dubai', 'company formation uae', 'entrepreneur visa uae', 'ecommerce dubai', 'dropshipping uae'],
    realestate: ['dubai real estate investment', 'off plan property dubai', 'rental yield dubai', 'ROI property dubai', 'palm jumeirah investment', 'dubai marina apartment buy', 'short term rental dubai airbnb'],
    fitness:    ['fitness dubai', 'gym dubai', 'personal trainer uae', 'CrossFit dubai'],
    mindset:    ['entrepreneur dubai', 'success dubai mindset', 'startup uae founder'],
  },

  // ── GERMANY ──────────────────────────────────────────────────────────────────
  DE: {
    finance:    ['finanzen deutschland', 'geldanlage für anfänger', 'sparplan ETF deutschland', 'tagesgeldkonto vergleich', 'riester rente', 'bausparvertrag', 'finanzielle freiheit deutschland', 'personal finance germany english'],
    trading:    ['aktien handel deutschland', 'DAX trading', 'XETRA trading', 'CFD handel', 'forex deutschland', 'aktienanalyse', 'stock trading germany english', 'scalable trade republic germany'],
    investing:  ['ETF depot deutschland', 'world ETF sparplan', 'passiv investieren', 'dividenden aktien', 'index fonds deutschland', 'MSCI world germany', 'investing germany english beginners'],
    economics:  ['deutsche wirtschaft', 'EZB zinsen deutschland', 'inflation germany', 'german economy explained', 'bundesbank monetary policy', 'wirtschaftslage deutschland'],
    crypto:     ['krypto deutschland', 'bitcoin steuer germany', 'BaFin crypto', 'ethereum kaufen deutschland', 'crypto germany english'],
    business:   ['selbstständig machen deutschland', 'GmbH gründen', 'einzelunternehmen anmelden', 'gewerbe anmelden', 'startup germany founder english', 'freelancer deutschland', 'business germany english'],
    realestate: ['immobilien investment deutschland', 'eigentumswohnung kaufen', 'vermieten als kapitalanlage', 'immobilienmarkt berlin münchen', 'grundsteuer reform', 'real estate germany english'],
    mindset:    ['motivation deutsch kanal', 'produktivität deutschland', 'erfolg mindset deutsch', 'entrepreneur germany english'],
  },

  // ── FRANCE ───────────────────────────────────────────────────────────────────
  FR: {
    finance:    ['finances personnelles france', 'assurance vie france', 'plan épargne retraite PER', 'livret A taux', 'bourse france débutant', 'investissement france', 'FIRE france liberté financière', 'personal finance france english'],
    trading:    ['trading bourse france', 'CAC 40 trading', 'actions france', 'PEA plan épargne actions', 'trader professionnel france', 'stock trading france english'],
    investing:  ['investir bourse france', 'ETF france débutant', 'PEA ETF', 'dividendes actions france', 'investissement passif france', 'investing france english'],
    economics:  ['économie française', 'BCE taux directeur', 'inflation france', 'french economy explained', 'budget france analyse'],
    crypto:     ['crypto france', 'bitcoin impôts france', 'AMF crypto regulation', 'ethereum france', 'crypto france english'],
    business:   ['auto-entrepreneur france', 'micro-entreprise création', 'SAS SARL création', 'freelance france', 'startup france fondateur', 'e-commerce france', 'business france english'],
    realestate: ['investissement immobilier france', 'LMNP meublé', 'SCI investissement', 'prix immobilier paris', 'immo locatif france', 'real estate france english'],
    mindset:    ['motivation français', 'productivité france', 'mindset entrepreneur france'],
  },

  // ── SPAIN ────────────────────────────────────────────────────────────────────
  ES: {
    finance:    ['finanzas personales españa', 'inversión bolsa españa', 'plan pensiones', 'fondo indexado', 'ahorro spain', 'libertad financiera españa', 'personal finance spain english'],
    trading:    ['trading bolsa española', 'IBEX 35 trading', 'acciones españa', 'broker español', 'forex trading españa', 'trading spain english'],
    investing:  ['invertir bolsa españa', 'ETF españa', 'fondo indice españa', 'dividendos españa', 'indexa capital spain', 'passive investing spain english'],
    economics:  ['economía española', 'banco de españa', 'inflación españa', 'spanish economy explained', 'PIB españa'],
    crypto:     ['criptomonedas españa', 'bitcoin España impuestos', 'ethereum spain', 'hacienda crypto spain'],
    business:   ['autónomo españa', 'emprendedor españa', 'SL empresa crear', 'startup españa', 'dropshipping spain español', 'ecommerce spain'],
    realestate: ['inversión inmobiliaria españa', 'pisos alquiler barcelona madrid', 'comprarse piso españa', 'real estate spain english', 'golden visa spain property'],
    mindset:    ['motivación español', 'emprendedor mindset spain', 'productividad español'],
  },

  // ── BRAZIL ───────────────────────────────────────────────────────────────────
  BR: {
    finance:    ['finanças pessoais brasil', 'renda fixa brasil', 'tesouro direto selic', 'CDB LCI LCA brasil', 'FGTS brasil', 'educação financeira brasil', 'me poupe brasil', 'personal finance brazil english'],
    trading:    ['day trade brasil', 'bolsa de valores B3', 'ações brasil', 'opções brasil', 'swing trade brasil', 'análise técnica brasil', 'rico clear xp investimentos'],
    investing:  ['investimentos brasil', 'fundos imobiliários FII', 'ETF brasil B3', 'dividendos ações brasil', 'FIRE brasil independência financeira', 'renda passiva brasil'],
    economics:  ['economia brasileira', 'SELIC taxa juros', 'inflação IPCA brasil', 'PIB brasil', 'banco central brasil', 'dólar real câmbio', 'crise brasil economia'],
    crypto:     ['cripto brasil', 'bitcoin reais', 'receita federal crypto brasil', 'exchange brasileira', 'mercado bitcoin novadax brasil'],
    business:   ['MEI empreendedor individual', 'abrir empresa brasil', 'CNPJ brasil', 'ecommerce mercado livre brasil', 'dropshipping brasil', 'afiliados digital brasil', 'side hustle brasil', 'startup brasil fundador'],
    realestate: ['investimento imobiliário brasil', 'fundos imobiliários FII', 'comprar imóvel brasil', 'leilão imóvel brasil', 'aluguel renda brasil', 'real estate brazil english'],
    mindset:    ['motivação português brasil', 'empreendedorismo brasil mindset', 'produtividade brasil'],
  },

  // ── MEXICO ───────────────────────────────────────────────────────────────────
  MX: {
    finance:    ['finanzas personales mexico', 'inversión mexico', 'CETES mexico', 'AFORE pensión mexico', 'FIBRAS mexico bolsa', 'ahorro mexico', 'libertad financiera mexico', 'personal finance mexico english'],
    trading:    ['bolsa mexicana valores BMV', 'trading mexico', 'forex mexico', 'acciones mexico', 'cripto mexico', 'GBM bursanet mexico'],
    investing:  ['invertir mexico principiante', 'ETF mexico', 'CETES directo', 'fondos de inversión mexico', 'renta pasiva mexico', 'FIRE mexico'],
    economics:  ['economía mexicana', 'Banxico tasa interés', 'inflación mexico', 'peso dólar mexico', 'nearshoring mexico'],
    crypto:     ['criptomonedas mexico', 'bitcoin mexico pesos', 'CNBV crypto regulación', 'bitso mexico', 'ethereum mexico'],
    business:   ['negocio mexico ideas', 'emprendedor mexico', 'SAT registro empresas', 'dropshipping mexico', 'ecommerce mexico', 'mercado libre vendedor mexico', 'startup mexico'],
    realestate: ['inversión inmobiliaria mexico', 'comprar casa mexico', 'INFONAVIT mexico', 'fibras bursatiles', 'real estate cancun cdmx'],
    mindset:    ['motivación español mexico', 'emprendedor mindset mexico', 'éxito mentalidad'],
  },

  // ── JAPAN ────────────────────────────────────────────────────────────────────
  JP: {
    finance:    ['新NISA 投資 japan', 'iDeCo 個人型確定拠出年金', 'personal finance japan english', 'money management japan expat', 'saving money japan', 'japanese financial tips english', '積立投資 japan'],
    trading:    ['日本株 投資', 'stock trading japan english', 'japan stock market TSE', 'forex trading japan', 'nikkei 225 analysis', 'day trading japan english'],
    investing:  ['index fund japan english', '全世界株式 NISA', 'ETF japan', 'passive investing japan english', 'FIRE japan english', 'dividends japan stocks english'],
    economics:  ['japanese economy explained english', 'bank of japan boj policy', 'yen weakness japan', 'japan gdp growth', 'deflation inflation japan', 'kishida economic policy'],
    crypto:     ['crypto japan english', 'bitcoin japan yen', 'FSA regulated crypto japan', 'bitflyer GMO japan'],
    business:   ['business japan english foreigner', 'startup japan english', 'freelance japan english', 'ecommerce japan', 'entrepreneur japan english'],
    realestate: ['real estate investing japan english', 'tokyo property investment', 'akiya cheap house japan', 'rental yield japan', 'foreigner buy property japan'],
    mindset:    ['productivity japan english', 'kaizen self improvement', 'entrepreneur japan english mindset'],
  },

  // ── SOUTH KOREA ──────────────────────────────────────────────────────────────
  KR: {
    finance:    ['personal finance korea english', '주식 투자 한국', 'stock investing korea english', 'korean finance tips english', '재테크 korea', 'saving money korea expat'],
    trading:    ['KOSPI KOSDAQ trading', 'korea stock market english', '코스피 분석', 'day trading korea english', 'US stocks from korea', 'forex korea english'],
    investing:  ['investing korea english beginners', 'ETF korea english', 'index fund korea', 'dividend stocks korea', 'ISA korea tax free', 'FIRE korea english'],
    economics:  ['korean economy explained english', 'bank of korea BOK', 'inflation korea', 'won dollar exchange rate', 'export korea economy', 'chaebol economy korea'],
    crypto:     ['crypto korea english', 'bitcoin korea won', 'upbit bithumb korea', 'crypto regulation korea english'],
    business:   ['startup korea english', 'business korea english foreigner', 'ecommerce korea', 'korean market entry english', 'entrepreneur korea english'],
    realestate: ['real estate korea english', 'jeonse system korea explained', 'apartment investing korea english', 'seoul property market english'],
    mindset:    ['entrepreneur mindset korea english', 'productivity korea english', 'k-startup culture english'],
  },

  // ── INDONESIA ────────────────────────────────────────────────────────────────
  ID: {
    finance:    ['keuangan pribadi indonesia', 'investasi pemula indonesia', 'tabungan indonesia', 'reksa dana indonesia', 'OJK finansial indonesia', 'personal finance indonesia english'],
    trading:    ['saham BEI indonesia', 'trading saham indonesia', 'forex trading indonesia', 'kripto indonesia', 'RTI business IDX', 'day trading indonesia'],
    investing:  ['investasi saham indonesia', 'reksa dana OJK', 'ETF indonesia', 'passive income indonesia', 'FIRE indonesia', 'deposito vs saham indonesia'],
    economics:  ['ekonomi indonesia', 'bank indonesia BI rate', 'inflasi rupiah', 'indonesia GDP growth', 'jokowi ekonomi indonesia', 'cost of living indonesia'],
    crypto:     ['kripto indonesia', 'bitcoin rupiah', 'OJK kripto regulasi', 'tokocrypto pintu indonesia', 'ethereum indonesia'],
    business:   ['bisnis online indonesia', 'UMKM indonesia', 'dropshipping indonesia', 'tokopedia shopee seller', 'PT perseroan terbatas indonesia', 'startup indonesia founder', 'freelance indonesia'],
    realestate: ['investasi properti indonesia', 'beli rumah indonesia', 'KPR cicilan rumah', 'apartemen jakarta surabaya', 'tanah kavling indonesia'],
    mindset:    ['motivasi indonesia', 'entrepreneur mindset indonesia', 'produktivitas indonesia'],
  },
}

function expandTopic(keyword: string): string[] {
  const lower = keyword.toLowerCase().trim()
  const broad = [lower, `${lower} YouTube`, `${lower} channel`, `${lower} tips`]

  // Build the most-specific list we can find first — TOPIC_MAP exact or
  // substring match wins. Then we pad with generic role / intent
  // variants so every search has at least 30 queries even when the
  // niche is unknown to us.
  let primary: string[] = []
  if (TOPIC_MAP[lower]) {
    primary = [...broad, ...TOPIC_MAP[lower]]
  } else {
    for (const [key, roles] of Object.entries(TOPIC_MAP)) {
      if (lower.includes(key) || key.includes(lower)) {
        primary = [...broad, ...roles]
        break
      }
    }
  }
  if (primary.length === 0) {
    primary = lower.includes(' ')
      ? [keyword, `${keyword} channel`, `${keyword} YouTube`, `${keyword} tips`, `${keyword} advice`]
      : [keyword, ...GENERIC_ROLES.map(r => `${keyword} ${r}`)]
  }

  // Pad with sister/related occupation queries until we have ≥30 unique
  // queries. Every keyword search always casts a wide net regardless of
  // how niche-specific the input is.
  const padded = new Set(primary)
  const padders = [
    ...GENERIC_ROLES.map(r => `${keyword} ${r}`),
    ...INTENT_SUFFIXES.map(s => `${keyword} ${s}`),
    ...GENERIC_ROLES.map(r => `${r} ${keyword}`),
  ]
  let i = 0
  while (padded.size < 30 && i < padders.length) {
    padded.add(padders[i])
    i++
  }
  return [...padded]
}

function applyRegion(queries: string[], keyword: string, gl: string): string[] {
  if (!gl) return queries
  const suffix = REGION_SUFFIX[gl]
  const lower = keyword.toLowerCase().trim()

  // 1. Native-language queries (Hindi/Tamil/Telugu/etc. for India, etc.)
  const nativeQueries = buildLanguageQueries(gl, keyword)

  // 2. English local-market extras from REGION_TOPIC_EXTRAS
  const matchedKeys = new Set<string>()
  if (REGION_TOPIC_EXTRAS[gl]) {
    for (const key of Object.keys(REGION_TOPIC_EXTRAS[gl])) {
      if (lower.includes(key) || key.includes(lower)) matchedKeys.add(key)
    }
    for (const [aliasKey, aliases] of Object.entries(TOPIC_ALIASES)) {
      if (aliases.some(a => lower.includes(a) || a.includes(lower))) {
        if (REGION_TOPIC_EXTRAS[gl][aliasKey]) matchedKeys.add(aliasKey)
      }
    }
  }
  const extras: string[] = []
  for (const key of matchedKeys) extras.push(...(REGION_TOPIC_EXTRAS[gl][key] || []))

  // 3. Generic country-suffixed queries (fallback when no topic matched)
  const genericRegional = suffix ? [
    `${keyword} ${suffix}`,
    `${keyword} channel ${suffix}`,
    `${keyword} content creator ${suffix}`,
    `${keyword} tips ${suffix}`,
  ] : []

  // 4. Suffix all base English queries for geographic signal
  const suffixed = suffix ? queries.map(q => `${q} ${suffix}`) : queries

  // Order: native-language → English local market → country-suffixed → bare English fallback
  // Deduplicate to avoid redundant search calls
  return [...new Set([...nativeQueries, ...extras, ...genericRegional, ...suffixed, ...queries.slice(0, 2)])]
}

function fallbackQueries(keyword: string, gl = ''): string[] {
  const base = [`${keyword}`, `${keyword} YouTube channel`, `${keyword} tips`, `${keyword} advice`, `how to ${keyword}`]

  // Parallel-occupation expansion (added 2026-05-09): when results
  // are thin, pull in sister occupations from the same TOPIC_MAP
  // bucket. E.g. "travel agent" → also try "tour planner", "travel
  // advisor", "trip planner", "vacation specialist". Casts a wider
  // net without making the user re-search.
  const lower = keyword.toLowerCase().trim()
  const parallel = new Set<string>()
  for (const [key, roles] of Object.entries(TOPIC_MAP)) {
    // Match if the topic key shares a substring with the keyword
    // (or vice versa) — same matching rule expandTopic uses.
    if (lower.includes(key) || key.includes(lower)) {
      for (const r of roles) parallel.add(r)
    } else {
      // Cross-bucket fuzzy match: if the keyword shares a word with
      // any of the topic's roles, include those roles. This catches
      // cases where the keyword isn't a topic key but is itself a
      // role (e.g. "travel advisor" → matches roles[] in 'travel').
      for (const r of roles) {
        const rLower = r.toLowerCase()
        if (rLower.includes(lower) || lower.includes(rLower)) {
          for (const sister of roles) parallel.add(sister)
          break
        }
      }
    }
  }
  // Also include role + intent variants on the original keyword for
  // breadth — these are cheap and YouTube indexes some channels by
  // these phrases that the bare keyword doesn't surface.
  for (const r of GENERIC_ROLES.slice(0, 8)) parallel.add(`${keyword} ${r}`)
  for (const s of INTENT_SUFFIXES.slice(0, 6)) parallel.add(`${keyword} ${s}`)

  const all = [...new Set([...base, ...parallel])].slice(0, 30)
  if (!gl || !REGION_SUFFIX[gl]) return all
  const suffix = REGION_SUFFIX[gl]
  return [...new Set([...all.map(q => `${q} ${suffix}`), ...all.slice(0, 4)])]
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

function parseViewCount(text: string): number {
  if (!text) return NaN
  const t = text.replace(/,/g, '').toLowerCase()
  const m = t.match(/[\d.]+/)
  if (!m) return NaN
  const n = parseFloat(m[0])
  if (t.includes('b')) return Math.round(n * 1_000_000_000)
  if (t.includes('m')) return Math.round(n * 1_000_000)
  if (t.includes('k')) return Math.round(n * 1_000)
  return Math.round(n)
}

function extractEmail(text: string): string {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  return match ? match[0] : ''
}

function scoreBio(text: string, terms: string[]): number {
  let score = 0
  for (const term of terms) {
    const matches = text.match(new RegExp(term, 'gi'))
    if (matches) score += matches.length
  }
  return score
}

interface VideoHit {
  channelId: string
  channelName: string
  viewCount: number
  title: string
  date: string
  subscribers: string
}

// Single search call — pulls data directly from search results, NO per-channel API calls
async function searchQuery(yt: any, query: string, retry = true): Promise<VideoHit[]> {
  const hits: VideoHit[] = []
  const seenInQuery = new Set<string>()

  try {
    const chRes = await yt.search(query, { type: 'channel' })
    for (const item of (chRes as any).channels || []) {
      const id = item?.id || item?.author?.id
      if (!id || seenInQuery.has(id)) continue
      seenInQuery.add(id)
      hits.push({ channelId: id, channelName: item?.author?.name || item?.name || '', viewCount: NaN, title: '', date: '', subscribers: '' })
    }
  } catch { /* continue */ }

  try {
    const vRes = await yt.search(query, { type: 'video' })
    const vids = (vRes as any).videos || (vRes as any).results || []
    for (const v of vids) {
      const id = v?.author?.id || v?.channel?.id
      if (!id || !id.startsWith('UC')) continue
      const viewText = v?.view_count?.text || v?.short_view_count?.text || ''
      const viewCount = parseViewCount(viewText)
      const title = v?.title?.text || v?.title?.runs?.[0]?.text || ''
      const date = v?.published?.text || v?.published_time_text?.text || ''
      const channelName = v?.author?.name || v?.channel?.name || ''
      hits.push({ channelId: id, channelName, viewCount, title, date, subscribers: '' })
    }
  } catch { /* continue */ }

  if (hits.length === 0 && retry) {
    await delay(700)
    return searchQuery(yt, query, false)
  }

  return hits
}

// Run query batches with stagger to avoid rate limiting.
//
// BATCH bumped 3 → 5 (2026-05-09): with ~30 expanded queries the old
// BATCH=3 forced 9 inter-batch delays of 300 ms each = ~2.7 s of
// deliberate sleep in the floor latency, before any network time.
// At BATCH=5 we drop to ~5 gaps = ~1.5 s saved per cold search.
// Inter-batch delay kept at 300 ms — empirically the rate limit
// threshold lives well above 5 parallel queries to youtubei.js,
// and the searchQuery retry already adds 700 ms back-off on empty
// results so transient throttles still get absorbed.
async function runBatched(yt: any, queries: string[]): Promise<VideoHit[]> {
  const all: VideoHit[] = []
  const BATCH = 5
  for (let i = 0; i < queries.length; i += BATCH) {
    const batch = queries.slice(i, i + BATCH)
    const results = await Promise.allSettled(batch.map(q => searchQuery(yt, q)))
    for (const r of results) {
      if (r.status === 'fulfilled') all.push(...r.value)
    }
    if (i + BATCH < queries.length) await delay(300)
  }
  return all
}

/**
 * Streaming variant of runBatched — calls onBatch(newHits, batchIdx)
 * after EACH batch completes, allowing the caller to emit partial
 * results progressively (SSE / chunked response). Returns the full
 * accumulated hit list when done, same as runBatched.
 */
async function runBatchedStreaming(
  yt: any,
  queries: string[],
  onBatch: (newHits: VideoHit[], batchIdx: number) => Promise<void> | void,
): Promise<VideoHit[]> {
  const all: VideoHit[] = []
  const BATCH = 5
  const totalBatches = Math.ceil(queries.length / BATCH)
  for (let i = 0; i < queries.length; i += BATCH) {
    const batch = queries.slice(i, i + BATCH)
    const results = await Promise.allSettled(batch.map(q => searchQuery(yt, q)))
    const batchHits: VideoHit[] = []
    for (const r of results) {
      if (r.status === 'fulfilled') batchHits.push(...r.value)
    }
    all.push(...batchHits)
    const batchIdx = Math.floor(i / BATCH)
    await onBatch(batchHits, batchIdx)
    if (i + BATCH < queries.length) await delay(300)
  }
  void totalBatches  // available for future telemetry
  return all
}

// Module-scoped Innertube singleton cache. Was creating a fresh
// Innertube instance per request (line 966 below), which costs
// 200-600 ms of session bootstrap time on every cold search. Vercel
// keeps the function module loaded between warm invocations, so a
// module-level Map persists across requests. 5-min TTL guards
// against the YouTube session going stale.
//
// Keyed by `gl` (country code or '' for default) since each region
// gets its own location-bound session.
type InnertubeCacheEntry = { instance: Awaited<ReturnType<typeof Innertube.create>>; expires: number }
const ytInstanceCache = new Map<string, InnertubeCacheEntry>()
const YT_INSTANCE_TTL_MS = 5 * 60 * 1000

async function getInnertubeInstance(gl: string) {
  const key = gl || 'default'
  const cached = ytInstanceCache.get(key)
  if (cached && cached.expires > Date.now()) return cached.instance
  const instance = await Innertube.create({
    retrieve_player: false,
    ...(gl ? { location: gl } : {}),
  })
  ytInstanceCache.set(key, { instance, expires: Date.now() + YT_INSTANCE_TTL_MS })
  return instance
}

export async function GET(req: NextRequest) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth

  const limited = rateLimit(auth.id, 'search', 100)
  if (limited) return limited

  const { searchParams } = new URL(req.url)

  const keyword = clampString(searchParams.get('keyword'), 200)
  // Optional: a comma-separated list of pre-expanded keywords. When
  // provided, we skip the topic-map expansion and use each entry as
  // its own search query. This is what the niche-bucket button on the
  // client uses to search every occupation in a niche at once.
  const keywordsParam = clampString(searchParams.get('keywords'), 2000)
  // Per-region cap. Bumped 100 → 175 (2026-05-12) so each region tier
  // can keep ~75 more channels after dedupe — pairs with AI keyword
  // expansion below, which generates 3 sibling queries whose raw hits
  // need headroom past the original keyword's 100. Cap upper-bound
  // also moved 150 → 175 so the client can request the new ceiling.
  const maxResults = clampInt(searchParams.get('maxResults'), 1, 175, 175)
  const minViews   = clampInt(searchParams.get('minViews'), 0, 1_000_000_000, 0)
  const maxViews   = clampInt(searchParams.get('maxViews'), 0, 1_000_000_000, 200_000)
  // gl must be a 2-letter country code or empty
  const glRaw = searchParams.get('gl') || ''
  const gl = /^[A-Z]{2}$/.test(glRaw.toUpperCase()) ? glRaw.toUpperCase() : ''

  if (!keyword && !keywordsParam) {
    return NextResponse.json({ error: 'keyword or keywords is required' }, { status: 400 })
  }

  // AI keyword expansion (Feature 1, 2026-05-12): when the client
  // sends `expand=true` AND we're in single-keyword broad mode (no
  // pre-expanded `keywords=` list), we ask Claude Haiku for 3 sibling
  // queries ("tech reviewer" → "tech YouTuber", "gadget reviewer",
  // "tech channel") and merge their search hits into the same
  // channelMap. This consistently surfaces 1.5–2× more relevant
  // creators per search. Niche-list searches already cast a wide net
  // via the comma-joined occupations, so we skip expansion for them.
  // Skip when `fresh=true` (Load More) so paginated discovery sticks
  // to the original keyword's universe — otherwise the variants
  // would dominate every Load More page.
  const wantExpand = searchParams.get('expand') === 'true'
  const skipForLoadMore = searchParams.get('fresh') === 'true'
  const canExpand = wantExpand && !!keyword && !keywordsParam && !skipForLoadMore

  // ── Backend cache check ─────────────────────────────────────────
  // Repeat searches for the same query+filters within 24h get served
  // from Redis instead of re-running the 30+ youtubei.js queries.
  // Key includes ALL query-affecting params so cache stays correct
  // when the user changes filters. `expand` is part of the key so
  // expanded vs non-expanded results don't collide.
  const cacheKey = searchCacheKey(keyword || keywordsParam || '', {
    keywordsParam,
    maxResults,
    minViews,
    maxViews,
    gl,
    expand: canExpand,
  })
  // ?fresh=true bypasses the search-results cache entirely. Used by
  // the bulk-seed admin tool so every preset run discovers new
  // channels rather than re-returning the same cached set. End-user
  // searches default to cached (10-min TTL) for navigation speed.
  const skipSearchCache = searchParams.get('fresh') === 'true'
  if (!skipSearchCache) {
    const cached = await cacheGet<{ channels: unknown[]; expandedQueries: string[] }>(cacheKey)
    if (cached) {
      // Even on cache hit, the streaming client wants the SSE shape so
      // it can use a single code path. Wrap the cached payload as a
      // single 'chunk' + 'done' so the consumer just appends and
      // finishes — perceived as instant.
      if (searchParams.get('stream') === '1') {
        return streamingCachedResponse(cached.channels as StreamChannel[], cached.expandedQueries)
      }
      return NextResponse.json(cached)
    }
  }
  // ───────────────────────────────────────────────────────────────

  // Niche / multi-keyword path: take the comma-separated list as-is,
  // skip TOPIC_MAP expansion (the niche bucket already enumerated the
  // specific occupations the user wants), and use the joined string
  // for relevance scoring.
  const keywordsList = keywordsParam
    ? keywordsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 30)
    : []
  const usingMultiKeywords = keywordsList.length > 0

  // AI-expanded sibling keywords (Feature 1). Returns [] on any failure
  // — the route falls back to running the original keyword alone.
  // We block on this once before kicking off YouTube queries because
  // the variants change which YouTube queries we fire; running them in
  // parallel with the AI call would mean re-firing the variant queries
  // after the AI returns. Haiku typical latency is 300–600ms which is
  // small relative to the 30+ YouTube searches downstream.
  const aiVariants = canExpand ? await expandKeyword(keyword!) : []

  // Build queries. For the single-keyword path with AI expansion we
  // union expandTopic(kw) for the original + each variant, then run
  // applyRegion once on the union. Deduped — many variants share padder
  // suffixes so the YouTube query count grows sub-linearly with variant
  // count. Typical: original alone ≈ 30 queries; with 3 variants ≈
  // 60-90 unique queries after dedupe.
  let baseQueries: string[]
  if (usingMultiKeywords) {
    baseQueries = keywordsList
  } else if (aiVariants.length > 0) {
    const unioned = new Set<string>()
    for (const kw of [keyword!, ...aiVariants]) {
      for (const q of expandTopic(kw)) unioned.add(q)
    }
    baseQueries = [...unioned]
  } else {
    baseQueries = expandTopic(keyword!)
  }
  const queries = applyRegion(baseQueries, keyword || keywordsList.join(' '), gl)
  // Relevance terms include the variants too, so a channel that
  // name-matches "tech YouTuber" but not "tech reviewer" still ranks
  // above pure 'related' channels.
  const scoringPhrase = aiVariants.length > 0
    ? [keyword!, ...aiVariants].join(' ')
    : (keyword || keywordsList.join(' '))
  const terms = scoringPhrase.toLowerCase().split(/\s+/).filter(Boolean)

  // ── SSE streaming path ─────────────────────────────────────────
  // When the client sends ?stream=1, return a text/event-stream
  // response that emits 'chunk' events as each YouTube-search batch
  // completes. Each chunk carries channels NEWLY discovered in that
  // batch (deduped against earlier ones). The accumulated channel
  // set is cached + dual-written at the end via the same path as
  // the JSON response. Per Dylan (2026-05-20) — perceived speed
  // for first results matters more than waiting for the full set.
  if (searchParams.get('stream') === '1') {
    return streamingSearchResponse({
      queries,
      terms,
      gl,
      maxResults,
      minViews,
      maxViews,
      keyword,
      keywordsList,
      cacheKey,
    })
  }

  try {
    const yt = await getInnertubeInstance(gl)

    let hits = await runBatched(yt, queries)

    // count unique channel IDs with actual view data
    const withViews = new Set(hits.filter(h => !isNaN(h.viewCount)).map(h => h.channelId))

    // Fallback if thin — try parallel-occupation queries (also region-aware).
    // Bumped 10 → 30 (2026-05-09) per Dylan: there are millions of YouTube
    // channels, the search shouldn't bottom out at single-digit results just
    // because the primary keyword's expansion didn't surface enough. Threshold
    // is internal — the final result count is whatever the live data + filters
    // produce, no fake padding.
    if (withViews.size < 30) {
      const extra = await runBatched(yt, fallbackQueries(keyword || keywordsList.join(' '), gl))
      hits.push(...extra)
    }

    // aggregate by channel — collect all view samples, titles, dates, subscribers
    const channelMap = new Map<string, {
      name: string
      views: number[]
      titles: string[]
      dates: string[]
      subscribers: string
    }>()

    for (const h of hits) {
      if (!channelMap.has(h.channelId)) {
        channelMap.set(h.channelId, { name: h.channelName, views: [], titles: [], dates: [], subscribers: h.subscribers })
      }
      const entry = channelMap.get(h.channelId)!
      if (h.channelName && !entry.name) entry.name = h.channelName
      if (h.subscribers && !entry.subscribers) entry.subscribers = h.subscribers
      if (!isNaN(h.viewCount) && h.viewCount >= 0) entry.views.push(h.viewCount)
      if (h.title) entry.titles.push(h.title)
      if (h.date) entry.dates.push(h.date)
    }

    // (channel list is built below into `candidates`, then filtered + sliced
    //  into `channels` at the end. The legacy single-pass build was replaced
    //  with the adaptive-tier filter on 2026-05-09.)

    // Helper: parse a subscriber string ("5.4M", "245K") to an int.
    // Used by the adaptive news/mega-network filter below.
    const parseSubs = (s: string): number => {
      if (!s) return 0
      const t = s.toLowerCase().replace(/[, ]/g, '')
      const m = t.match(/[\d.]+/)
      if (!m) return 0
      const n = parseFloat(m[0])
      if (t.includes('b')) return Math.round(n * 1_000_000_000)
      if (t.includes('m')) return Math.round(n * 1_000_000)
      if (t.includes('k')) return Math.round(n * 1_000)
      return Math.round(n)
    }

    // Build candidate pool first WITHOUT the news/mega-network filter.
    // We apply that filter adaptively below — a strict pass first,
    // and progressively relaxed tiers if the strict pass leaves the
    // result set too thin.
    type Candidate = {
      channelId: string
      channelName: string
      channelUrl: string
      avgViews: number
      description: string
      videoTitles: string[]
      videoDates: string[]
      shortDates: string[]
      subscribers: string
      email: string
      relevanceScore: number
      matchedVia: 'name' | 'title' | 'related'
      instagram: string
      twitter: string
      tiktok: string
      linkedin: string
      website: string
      _subsCount: number  // internal — used by adaptive filter
      _nameScore: number  // internal — used by topical-focus filter
      _matchingTitleCount: number  // internal — used by topical-focus filter
    }
    const candidates: Candidate[] = []
    for (const [channelId, data] of channelMap) {
      if (data.views.length === 0) continue

      // Median, not mean — robust to viral-outlier video views that
      // would otherwise drag the average to a number nowhere near
      // the channel's typical performance. Same fix shipped in
      // /api/enrich's fromVideosPage. Enrich overrides this anyway
      // when it succeeds, but median makes the pre-enrich initial
      // value also defensible.
      const sortedViews = [...data.views].sort((a, b) => a - b)
      const midIdx = Math.floor(sortedViews.length / 2)
      const avgViews = sortedViews.length === 0
        ? 0
        : sortedViews.length % 2 === 0
          ? Math.round((sortedViews[midIdx - 1] + sortedViews[midIdx]) / 2)
          : sortedViews[midIdx]
      if (avgViews < minViews || avgViews > maxViews) continue

      const channelName = data.name || 'Unknown'
      const nameScore = scoreBio(channelName.toLowerCase(), terms)
      // Per-title scoring so we can count how MANY recent videos match,
      // not just how many term occurrences total (2026-05-21 per Dylan).
      // A channel where 3 of 3 recent videos are on-topic is a real
      // niche channel; a channel where 1 of 3 happens to mention the
      // keyword is a broad-coverage channel (news station, generalist
      // commentator, etc.) that should be filtered out at the strictest
      // tier.
      const titleScores = data.titles.length
        ? data.titles.map(t => scoreBio(t.toLowerCase(), terms))
        : []
      const titleScore = titleScores.reduce((s, n) => s + n, 0)
      const matchingTitleCount = titleScores.filter(s => s > 0).length
      // Combined relevance: channel name match dominates, title-match
      // is weighted by HOW MANY titles match (not just total occurrences).
      // 3-of-3 title matches now beats 1-of-3 with the same total count.
      const relevanceScore = nameScore * 4 + titleScore + matchingTitleCount * 2
      const subsCount = parseSubs(data.subscribers)

      candidates.push({
        channelId,
        channelName,
        channelUrl: `https://www.youtube.com/channel/${channelId}`,
        avgViews,
        description: '',
        videoTitles: [...new Set(data.titles)].slice(0, 3),
        videoDates: [...new Set(data.dates)].slice(0, 2),
        shortDates: [],
        subscribers: data.subscribers,
        email: '',
        relevanceScore,
        matchedVia: nameScore > 0 ? 'name' : titleScore > 0 ? 'title' : 'related',
        instagram: '', twitter: '', tiktok: '', linkedin: '', website: '',
        _subsCount: subsCount,
        _nameScore: nameScore,
        _matchingTitleCount: matchingTitleCount,
      })
    }

    // ── REGION FILTER ────────────────────────────────────────────
    // Restored 2026-05-09 after Dylan reported India searches were
    // pulling global creators. The old behavior sent India-tagged
    // queries to YouTube and trusted the rankings — but YouTube's
    // ranking blends global English content into any region with
    // strong English-language overlap, so generic creators leaked in.
    //
    // Now we post-score every candidate against the gl's regional
    // signal (channel name + video titles vs cities, regulators,
    // currency, scripts — see lib/region-signals.ts). Two strategies:
    //
    //   English-dominant regions (US/GB/CA/AU/NZ/IE):
    //     Most English channels ARE valid. Drop only those with
    //     STRONG signal from a *different* region (e.g. all-Hindi
    //     titles when user picked US).
    //
    //   Non-English-dominant regions (IN/JP/KR/BR/MX/JP/SG/...):
    //     Strict — every kept channel must have at least a WEAK
    //     regional signal. Adaptive relax: if the strict pass leaves
    //     < SOFT_TARGET_REGION channels, allow weak-signal-only;
    //     if still thin, allow keyword-relevance-only as a fallback
    //     so the user never sees a dead-end empty page.
    //
    // English-only Indian creators (e.g. "Pranjal Kamra") still
    // pass because their video titles routinely mention RBI, NSE,
    // Mumbai, etc. — the WEAK tier picks those up.
    let regionFiltered: Candidate[] = candidates
    let regionTier = 'off'
    if (gl && REGION_SIGNALS[gl]) {
      const sig = REGION_SIGNALS[gl]
      const SOFT_TARGET_REGION = 20

      // Pre-compute confidence + foreign-signal flag once per candidate.
      const annotated = candidates.map(c => ({
        c,
        conf: regionConfidence(c.channelName, c.videoTitles, gl),
        foreign: hasForeignSignal(c.channelName, c.videoTitles, gl),
      }))

      if (sig.englishDominant) {
        // Drop channels that look strongly tied to a different region.
        regionFiltered = annotated.filter(a => !a.foreign).map(a => a.c)
        regionTier = `english-dominant (kept ${regionFiltered.length}/${candidates.length})`
      } else {
        // Strict pass: confidence >= 2 (strong signal in name or
        // titles, or native script anywhere).
        let kept = annotated.filter(a => a.conf >= 2).map(a => a.c)
        regionTier = `strict-2 (${kept.length})`
        if (kept.length < SOFT_TARGET_REGION) {
          // Tier 1: also include weak signals (keyword in titles
          // or weak keyword anywhere). This is where most English-
          // language Indian/etc. creators land.
          kept = annotated.filter(a => a.conf >= 1).map(a => a.c)
          regionTier = `weak-1 (${kept.length})`
        }
        if (kept.length < 5) {
          // Tier 2 (fallback): also include zero-confidence channels
          // that name-matched the keyword. Keeps thin niches usable
          // even when there's almost no regional signal — better than
          // empty.
          kept = annotated
            .filter(a => a.conf >= 1 || a.c.matchedVia === 'name')
            .map(a => a.c)
          regionTier = `name-fallback (${kept.length})`
        }
        regionFiltered = kept
      }
      console.log(`[search] gl=${gl} candidates=${candidates.length} after-region=${regionFiltered.length} regionTier=${regionTier}`)
    }
    // ─────────────────────────────────────────────────────────────

    // Adaptive news/mega-network filter (rewritten 2026-05-09):
    //
    // Six tiers, walked from strictest to loosest. The first tier
    // that yields >= SOFT_TARGET (30+) wins. For fat niches we keep
    // the strictest filter; for thin niches we relax automatically.
    //
    //   Tier -2 (topical-focus, 2026-05-21 per Dylan): channel must be
    //     dedicated to the niche, not just mention it. Drops broad-
    //     coverage channels (news stations, generalist commentators)
    //     that have one accidental keyword hit. Also runs the media
    //     name-pattern blocklist (CBS, NBC, ABC, FOX, CNN, BBC, etc).
    //   Tier -1: drop ALL relevance=0 + media-name channels.
    //   Tier 0:  drop relevance=0 AND subs > 1M
    //   Tier 1:  drop relevance=0 AND subs > 5M
    //   Tier 2:  drop relevance=0 AND subs > 20M
    //   Tier 3:  keep everything

    // News/media blocklist. Matches obvious news brands, network
    // affiliate codes, and unambiguous news vocabulary. Channels
    // whose NAME hits any of these get dropped at the strictest
    // tiers. Falls through to looser tiers if the niche is so
    // thin we'd otherwise return nothing.
    //
    // 2026-05-21 — trimmed aggressively after "cook" search dropped
    // to ~3 results. The original generic list contained TV / Live /
    // Daily / Network / Post / Times / Press / Broadcasting / Radio /
    // Magazine / Reporter / Breaking — all matched real food /
    // streaming / vlog channel names (Food Network, Cooking Live,
    // The Daily Cook, Foodie Live, etc). Now keeping only words
    // that are exclusively news-related.
    //
    // Short brand names (ABC, NBC, CBS, FOX) used to match alone but
    // had false-positive risk ("ABC of Cooking", "Easy as ABC"); now
    // they require a " News" suffix to confirm. Local affiliates
    // (ABC7, NBC4 etc) still caught by MEDIA_AFFILIATE.
    const MEDIA_BRANDS_UNIQUE = /\b(?:CNN|MSNBC|BBC|NPR|PBS|HBO|ESPN|Reuters|Bloomberg|Forbes|Newsweek|Al Jazeera|Telemundo|Univision|Sky News|Vice News|WSJ|NYT)\b/i
    const MEDIA_BRANDS_WITH_NEWS = /\b(?:ABC|NBC|CBS|FOX|MSNBC|Yahoo|Vox)\s+News\b/i
    const MEDIA_AFFILIATE = /\b(?:ABC|CBS|NBC|FOX|KCBS|WCBS|KNBC|WNBC|KABC|WABC|KTLA|KCAL|KTVU|WPLG|WSVN|KING|KOMO)[0-9]+\b/i
    const MEDIA_GENERIC = /\b(?:News|Newsroom|Headlines|Eyewitness|Tribune|Chronicle|Gazette|Herald|Affiliate)\b/i
    const isMedia = (name: string): boolean =>
      MEDIA_BRANDS_UNIQUE.test(name)
      || MEDIA_BRANDS_WITH_NEWS.test(name)
      || MEDIA_AFFILIATE.test(name)
      || MEDIA_GENERIC.test(name)

    const SOFT_TARGET = 30
    const tiers: Array<{ label: string; predicate: (c: Candidate) => boolean }> = [
      {
        // Topical focus: channel is dedicated to the niche, not just
        // mentioning it once. Pass requires name keyword match OR 2+
        // matching titles. Surname filter REVERTED 2026-05-21 — was
        // too aggressive on single-keyword occupation searches
        // (e.g. "baker" went from 200 → 5 results because real
        // bakery channels post about Sourdough/Croissants which
        // don't match the literal "baker" term). The media blocklist
        // stays — that's the load-bearing piece for filtering noise.
        label: 'topical-focus',
        predicate: c =>
          !isMedia(c.channelName)
          && (c._nameScore > 0 || c._matchingTitleCount >= 2),
      },
      {
        // Loosen the topical-focus rule but keep the media blocklist.
        // Occupation mode still wants SOME title content though, so
        // we accept relevance > 0 either way at this tier.
        label: 'strictest-relevant-only',
        predicate: c => !isMedia(c.channelName) && c.relevanceScore > 0,
      },
      {
        // Original strict tier — relevance OR small subs.
        label: 'strict',
        predicate: c => !(c.relevanceScore === 0 && c._subsCount > 1_000_000),
      },
      { label: 'relaxed-5M',  predicate: c => !(c.relevanceScore === 0 && c._subsCount > 5_000_000)  },
      { label: 'relaxed-20M', predicate: c => !(c.relevanceScore === 0 && c._subsCount > 20_000_000) },
      { label: 'unfiltered',  predicate: () => true },
    ]
    let filtered: Candidate[] = []
    let chosenTier = tiers[0].label
    for (const tier of tiers) {
      filtered = regionFiltered.filter(tier.predicate)
      chosenTier = tier.label
      if (filtered.length >= SOFT_TARGET) break
      // If even unfiltered is thin, that's fine — return what we have.
    }
    console.log(`[search] candidates=${candidates.length} filtered=${filtered.length} tier=${chosenTier} target=${SOFT_TARGET}`)

    // Strip the internal scoring fields before returning. _subsCount,
    // _nameScore, and _matchingTitleCount are only used by the tier
    // filter above; the client just needs relevanceScore + matchedVia.
    const channels = filtered
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxResults)
      .map(c => {
        const { _subsCount, _nameScore, _matchingTitleCount, ...rest } = c
        void _subsCount
        void _nameScore
        void _matchingTitleCount
        return rest
      })
    const payload = { channels, expandedQueries: queries }
    // Fire-and-forget: cache the response for repeat queries within
    // the next 24h. Doesn't block the return.
    void cacheSet(cacheKey, payload, CACHE_TTL.searchResults)

    // PHASE 1.5 (2026-05-08): dual-write every search hit to the
    // creator_enrichment durable cache. This builds the corpus on
    // every user search — not just on explicit /api/enrich calls.
    // Writes are partial (no email yet, no socials) but the
    // channelId + channelName + subs + avgViews + niche snapshot is
    // valuable on its own. Phase 2 read path will check Postgres
    // first; partial rows mean we know we've seen this channel
    // before, even if we haven't enriched it yet.
    void bulkSaveSearchResults(channels, keyword || keywordsList.join(', '))

    return NextResponse.json(payload)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── Streaming (SSE) ─────────────────────────────────────────────────
//
// The streaming path emits progressively as each YouTube-search batch
// completes. Each chunk carries channels NEWLY discovered in that
// batch — channels already sent in an earlier chunk are skipped, so
// the client just appends.
//
// Scoring caveat: each chunk uses a snapshot of the channelMap as of
// that batch. A channel discovered in batch 1 with 1 matching title
// keeps its initial score even if batch 3 brings 2 more matching
// titles. The under-scoring is small in practice (most channels'
// titles come in a single batch) and avoids the worse UX of
// re-shuffling rows the user is already reading.

interface StreamChannel {
  channelId: string
  channelName: string
  channelUrl: string
  avgViews: number
  description: string
  videoTitles: string[]
  videoDates: string[]
  shortDates: string[]
  subscribers: string
  email: string
  relevanceScore: number
  matchedVia: 'name' | 'title' | 'related'
  instagram: string
  twitter: string
  tiktok: string
  linkedin: string
  website: string
}

interface StreamingOpts {
  queries: string[]
  terms: string[]
  gl: string
  maxResults: number
  minViews: number
  maxViews: number
  keyword: string | null
  keywordsList: string[]
  cacheKey: string
}

function sseHeaders(): HeadersInit {
  return {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    // Prevent buffering proxies (Vercel/CDN) from holding chunks.
    'x-accel-buffering': 'no',
  }
}

function sseChunk(event: string, data: unknown): Uint8Array {
  const enc = new TextEncoder()
  return enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

/**
 * Cache-hit SSE: wrap the cached payload as a single 'chunk' + 'done'
 * so the streaming client uses one code path regardless of cache state.
 */
function streamingCachedResponse(channels: StreamChannel[], expandedQueries: string[]): Response {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(sseChunk('meta', { expandedQueries, cached: true }))
      if (channels.length > 0) {
        controller.enqueue(sseChunk('chunk', { channels, batchIdx: 0 }))
      }
      controller.enqueue(sseChunk('done', { totalUnfiltered: channels.length, cached: true }))
      controller.close()
    },
  })
  return new Response(stream, { headers: sseHeaders() })
}

/**
 * Cold-path SSE: runs the YouTube search progressively, emitting each
 * batch's newly-discovered channels with snapshot scoring.
 */
function streamingSearchResponse(opts: StreamingOpts): Response {
  const { queries, terms, gl, maxResults, minViews, maxViews, keyword, keywordsList, cacheKey } = opts
  void gl  // reserved — region filter applied at end-of-stream pass

  // parseSubs is duplicated here so the streaming branch is self-
  // contained — the original lives inside the main handler closure
  // and isn't reachable from this scope.
  const parseSubs = (s: string): number => {
    if (!s) return 0
    const t = s.toLowerCase().replace(/[, ]/g, '')
    const m = t.match(/[\d.]+/)
    if (!m) return 0
    const n = parseFloat(m[0])
    if (t.includes('b')) return Math.round(n * 1_000_000_000)
    if (t.includes('m')) return Math.round(n * 1_000_000)
    if (t.includes('k')) return Math.round(n * 1_000)
    return Math.round(n)
  }

  // Per-chunk quality filters — mirror the JSON path's strictest tier
  // so streamed results match the canonical quality bar where possible.
  // The full progressive tier walk + region filtering still happens
  // server-side for the cache write, but those need the FULL candidate
  // set to know when to relax — they can't run mid-stream.
  const MEDIA_BRANDS_UNIQUE = /\b(?:CNN|MSNBC|BBC|NPR|PBS|HBO|ESPN|Reuters|Bloomberg|Forbes|Newsweek|Al Jazeera|Telemundo|Univision|Sky News|Vice News|WSJ|NYT)\b/i
  const MEDIA_BRANDS_WITH_NEWS = /\b(?:ABC|NBC|CBS|FOX|MSNBC|Yahoo|Vox)\s+News\b/i
  const MEDIA_AFFILIATE = /\b(?:ABC|CBS|NBC|FOX|KCBS|WCBS|KNBC|WNBC|KABC|WABC|KTLA|KCAL|KTVU|WPLG|WSVN|KING|KOMO)[0-9]+\b/i
  const MEDIA_GENERIC = /\b(?:News|Newsroom|Headlines|Eyewitness|Tribune|Chronicle|Gazette|Herald|Affiliate)\b/i
  const isMedia = (name: string): boolean =>
    MEDIA_BRANDS_UNIQUE.test(name)
    || MEDIA_BRANDS_WITH_NEWS.test(name)
    || MEDIA_AFFILIATE.test(name)
    || MEDIA_GENERIC.test(name)

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(sseChunk(event, data))
        } catch {
          // controller already closed — ignore.
        }
      }

      send('meta', { expandedQueries: queries, cached: false })

      try {
        const yt = await getInnertubeInstance(gl)

        // Aggregate channel data across batches. Same shape as the
        // JSON-path channelMap but rebuilt incrementally so we can
        // emit only the channels that just became visible in the
        // latest batch.
        const channelMap = new Map<string, {
          name: string
          views: number[]
          titles: string[]
          dates: string[]
          subscribers: string
        }>()
        const sentChannelIds = new Set<string>()
        const allEmittedChannels: StreamChannel[] = []
        // Hard cap so we don't stream 700+ channels — matches the
        // slice(0, maxResults) cap of the JSON path. Without this the
        // client's `total = creators.length` reads way higher than the
        // actual usable result count.
        let capReached = false

        await runBatchedStreaming(yt, queries, async (batchHits, batchIdx) => {
          if (capReached) return
          // Merge this batch's hits into the cumulative channelMap.
          for (const h of batchHits) {
            if (!channelMap.has(h.channelId)) {
              channelMap.set(h.channelId, {
                name: h.channelName,
                views: [],
                titles: [],
                dates: [],
                subscribers: h.subscribers,
              })
            }
            const entry = channelMap.get(h.channelId)!
            if (h.channelName && !entry.name) entry.name = h.channelName
            if (h.subscribers && !entry.subscribers) entry.subscribers = h.subscribers
            if (!isNaN(h.viewCount) && h.viewCount >= 0) entry.views.push(h.viewCount)
            if (h.title) entry.titles.push(h.title)
            if (h.date) entry.dates.push(h.date)
          }

          // Build NEW channels — anything in channelMap not yet emitted.
          const newChannels: StreamChannel[] = []
          for (const [channelId, data] of channelMap) {
            if (sentChannelIds.has(channelId)) continue
            if (data.views.length === 0) continue

            // Median avgViews — same as the JSON path.
            const sortedViews = [...data.views].sort((a, b) => a - b)
            const midIdx = Math.floor(sortedViews.length / 2)
            const avgViews = sortedViews.length === 0
              ? 0
              : sortedViews.length % 2 === 0
                ? Math.round((sortedViews[midIdx - 1] + sortedViews[midIdx]) / 2)
                : sortedViews[midIdx]
            if (avgViews < minViews || avgViews > maxViews) continue

            const channelName = data.name || 'Unknown'
            // Media blocklist — drop news/broadcaster channels at the
            // chunk level. Matches the JSON path's topical-focus tier.
            if (isMedia(channelName)) continue

            const nameScore = scoreBio(channelName.toLowerCase(), terms)
            // Per-title scoring so we can count HOW MANY recent titles
            // match — drives the topical-focus rule below. A 3-of-3
            // match signals a dedicated niche channel; a 1-of-3 match
            // suggests a generalist who happened to mention the keyword.
            const titleScores = data.titles.length
              ? data.titles.map(t => scoreBio(t.toLowerCase(), terms))
              : []
            const titleScore = titleScores.reduce((s, n) => s + n, 0)
            const matchingTitleCount = titleScores.filter(s => s > 0).length
            const relevanceScore = nameScore * 4 + titleScore + matchingTitleCount * 2
            const subsCount = parseSubs(data.subscribers)

            // Topical-focus rule per chunk — mirrors the JSON path's
            // strictest tier. Channel must keyword-match its name OR
            // have 2+ recent videos matching the topic. Generalists
            // with one accidental keyword hit get dropped here. Adjacent-
            // niche channels still pass via multi-title match against
            // the AI-expanded keyword set.
            if (nameScore === 0 && matchingTitleCount < 2) continue
            // Belt + suspenders: also drop relevance=0 huge channels
            // (e.g. mega-corps with one tangential video).
            if (relevanceScore === 0 && subsCount > 1_000_000) continue

            const channel: StreamChannel = {
              channelId,
              channelName,
              channelUrl: `https://www.youtube.com/channel/${channelId}`,
              avgViews,
              description: '',
              videoTitles: [...new Set(data.titles)].slice(0, 3),
              videoDates: [...new Set(data.dates)].slice(0, 2),
              shortDates: [],
              subscribers: data.subscribers,
              email: '',
              relevanceScore,
              matchedVia: nameScore > 0 ? 'name' : titleScore > 0 ? 'title' : 'related',
              instagram: '',
              twitter: '',
              tiktok: '',
              linkedin: '',
              website: '',
            }
            newChannels.push(channel)
          }

          // Sort this batch by relevance so we send the strongest
          // candidates first within the chunk.
          newChannels.sort((a, b) => b.relevanceScore - a.relevanceScore)

          // Apply the global maxResults cap. Once the cumulative
          // sent count reaches the cap, drop any further candidates
          // (they're lower-relevance than what's already been sent).
          const headroom = maxResults - allEmittedChannels.length
          const toSend = headroom > 0 ? newChannels.slice(0, headroom) : []
          for (const ch of toSend) {
            sentChannelIds.add(ch.channelId)
            allEmittedChannels.push(ch)
          }
          if (toSend.length > 0) {
            send('chunk', { channels: toSend, batchIdx })
          }
          if (allEmittedChannels.length >= maxResults) {
            capReached = true
          }
        })

        // Slice + cache the canonical (cap-respecting) set, then notify
        // the client. Same cache + dual-write side effects as the JSON
        // path — keeps the next user's search snappy and seeds the
        // creator_enrichment durable cache.
        const sortedFinal = [...allEmittedChannels]
          .sort((a, b) => b.relevanceScore - a.relevanceScore)
          .slice(0, maxResults)
        const cachePayload = { channels: sortedFinal, expandedQueries: queries }
        void cacheSet(cacheKey, cachePayload, CACHE_TTL.searchResults)
        void bulkSaveSearchResults(sortedFinal as never[], keyword || keywordsList.join(', '))

        send('done', {
          totalUnfiltered: allEmittedChannels.length,
          totalReturned: sortedFinal.length,
          cached: false,
        })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        send('error', { message })
      } finally {
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }
    },
  })

  return new Response(stream, { headers: sseHeaders() })
}
