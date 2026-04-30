import { NextRequest, NextResponse } from 'next/server'
import { Innertube } from 'youtubei.js'

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

const GENERIC_ROLES = ['coach', 'expert', 'content creator', 'consultant', 'educator', 'entrepreneur', 'influencer']

// Country name to append to every query for geographic signal
const REGION_SUFFIX: Record<string, string> = {
  IN: 'india', GB: 'uk', CA: 'canada', AU: 'australia', NZ: 'new zealand',
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
  // broad variants always included so the raw topic surfaces general channels
  const broad = [lower, `${lower} YouTube`, `${lower} channel`, `${lower} tips`]

  if (TOPIC_MAP[lower]) return [...broad, ...TOPIC_MAP[lower]]

  for (const [key, roles] of Object.entries(TOPIC_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return [...broad, ...roles]
  }

  if (lower.includes(' ')) {
    return [keyword, `${keyword} channel`, `${keyword} YouTube`, `${keyword} tips`, `${keyword} advice`]
  }
  return [keyword, ...GENERIC_ROLES.map(r => `${keyword} ${r}`)]
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
  if (!gl || !REGION_SUFFIX[gl]) return base
  const suffix = REGION_SUFFIX[gl]
  return [...base.map(q => `${q} ${suffix}`), ...base.slice(0, 2)]
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

// Run query batches with stagger to avoid rate limiting
async function runBatched(yt: any, queries: string[]): Promise<VideoHit[]> {
  const all: VideoHit[] = []
  const BATCH = 3
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const keyword = searchParams.get('keyword')
  const maxResults = parseInt(searchParams.get('maxResults') || '100')
  const minViews = parseInt(searchParams.get('minViews') || '0')
  const maxViews = parseInt(searchParams.get('maxViews') || '200000')
  const gl = searchParams.get('gl') || ''

  if (!keyword) return NextResponse.json({ error: 'keyword is required' }, { status: 400 })

  const baseQueries = expandTopic(keyword)
  const queries = applyRegion(baseQueries, keyword, gl)
  const terms = keyword.toLowerCase().split(/\s+/)

  try {
    const yt = await Innertube.create({ retrieve_player: false, ...(gl ? { location: gl } : {}) })

    let hits = await runBatched(yt, queries)

    // count unique channel IDs with actual view data
    const withViews = new Set(hits.filter(h => !isNaN(h.viewCount)).map(h => h.channelId))

    // fallback if thin — try broader queries (also region-aware)
    if (withViews.size < 10) {
      const extra = await runBatched(yt, fallbackQueries(keyword, gl))
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

    // build channel list — filter by avg views
    const channels: any[] = []

    for (const [channelId, data] of channelMap) {
      if (channels.length >= maxResults) break
      if (data.views.length === 0) continue

      const avgViews = Math.round(data.views.reduce((a, b) => a + b, 0) / data.views.length)
      if (avgViews < minViews || avgViews > maxViews) continue

      const channelName = data.name || 'Unknown'
      const nameScore = scoreBio(channelName.toLowerCase(), terms)

      channels.push({
        channelId,
        channelName,
        channelUrl: `https://www.youtube.com/channel/${channelId}`,
        avgViews,
        description: '',
        videoTitles: [...new Set(data.titles)].slice(0, 3),
        videoDates: [...new Set(data.dates)].slice(0, 2),
        subscribers: data.subscribers,
        email: '',
        relevanceScore: nameScore,
        matchedVia: nameScore > 0 ? 'name' : 'related',
        instagram: '', twitter: '', tiktok: '', linkedin: '', website: '',
      })
    }

    channels.sort((a, b) => b.relevanceScore - a.relevanceScore)
    return NextResponse.json({ channels, expandedQueries: queries })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
