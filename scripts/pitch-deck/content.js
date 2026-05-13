// Content for 18 topics × 7 variations = 126 slides.
// Each topic cycles through all 7 layouts so the deck has variety.
// Layout order: hero → split → grid3 → bigStat → quote → diagonal → bento

const TOPICS = [
  // ──────────────────────────────────────────────────────────────────
  // 1. COVER
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'cover',
    title: 'Cover',
    variations: [
      { layout: 'hero', content: {
        eyebrow: 'Pitch Deck · May 2026',
        title: 'Creator Outreach',
        subtitle: 'Find every creator who fits your brand. Reach them in one workflow. Across five platforms.',
        titleSize: 92,
      }},
      { layout: 'split', content: {
        eyebrow: 'Investor Preview',
        title: 'Outreach, finally built for the people doing it.',
        body: 'Creator Outreach is the operator-grade tool for finding, scoring, and contacting creators across YouTube, Instagram, TikTok, X, and LinkedIn — without juggling six tabs.',
        callout: '"Creator Outreach"\n\nv1.0 · 2026',
      }},
      { layout: 'grid3', content: {
        eyebrow: 'What we built',
        title: 'One workflow. Five platforms. Built by an operator.',
        subtitle: 'Discovery, qualification, and outreach in a single tool — designed around how founders actually run this work.',
        cards: [
          { title: 'Discover', body: 'Search YouTube, Instagram, TikTok, X, and LinkedIn from one query bar. Public data, structured.' },
          { title: 'Qualify', body: 'AI fit score against your criteria. Stop reading 80 bios to find the one that maps to your ICP.' },
          { title: 'Reach', body: 'Native Gmail compose, IG DM, LinkedIn message — with a CRM that tracks every reply.' },
        ],
      }},
      { layout: 'bigStat', content: {
        eyebrow: 'Cover · Pitch Deck',
        stat: '5x',
        statSize: 220,
        statLabel: 'Faster creator discovery vs. spreadsheet-and-tabs workflows.',
        body: 'Built by an operator who burned out doing this manually. Now the product runs the work.',
        source: 'Internal benchmarking, May 2026',
      }},
      { layout: 'quote', content: {
        quote: 'The tool I needed when I was running creator partnerships, and the one I would have paid anything for.',
        quoteSize: 36,
        attribution: 'Dylan Meehan',
        attributionSub: 'Founder, Creator Outreach',
      }},
      { layout: 'diagonal', content: {
        eyebrow: 'The Pitch',
        title: 'B2B creator outreach, in one place.',
        body: 'Built for founders, partnerships teams, and growth operators who already do creator outreach manually — and know how broken that workflow is.',
        callout: 'Pitch\nDeck\n2026',
      }},
      { layout: 'bento', content: {
        eyebrow: 'In one workspace',
        title: 'A purpose-built workflow for the work you already do.',
        cards: [
          { title: 'CREATOR OUTREACH', headline: 'One tool. Five platforms. Zero tab-juggling.', body: 'Discovery, AI scoring, native send, and CRM in a single workspace — built around real partnership workflows.' },
          { title: 'Built by', body: 'A founder who ran creator partnerships and rebuilt the workflow as software.' },
          { title: 'For', body: 'Founders, BD, partnerships, and growth teams running outbound to creators.' },
          { title: 'Today', body: '5 platforms supported. Native send via Gmail, IG, LinkedIn. Production live at creatoroutreach.net.' },
        ],
      }},
    ],
  },

  // ──────────────────────────────────────────────────────────────────
  // 2. PROBLEM (HOOK)
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'problem',
    title: 'Problem',
    variations: [
      { layout: 'hero', content: {
        eyebrow: 'The Problem',
        title: 'Finding the right creator takes hours. Most outreach never gets a reply.',
        subtitle: 'You search five platforms, paste into a spreadsheet, write the email yourself, and still hear nothing back. The work is real. The workflow is broken.',
        titleSize: 52,
      }},
      { layout: 'split', content: {
        eyebrow: 'The Pain',
        title: 'Outreach is a full-time job — for a part of the job no one asked for.',
        body: 'The actual work — picking the right creators and writing a message that resonates — gets buried under tab-switching, copy-pasting, and dead-end DMs. The bottleneck is workflow, not effort.',
        stat: '4h',
        statLabel: 'The time it takes to source and contact ten creators today. Most of it is plumbing.',
      }},
      { layout: 'grid3', content: {
        eyebrow: 'Where the time goes',
        title: 'Three problems compound — and there\'s no tool for any of them.',
        subtitle: 'Each one costs an hour. Stack them and the day is gone.',
        cards: [
          { title: 'Discovery is fragmented', body: 'YouTube, Instagram, TikTok, X, LinkedIn — five searches, five UIs, five exports. No tool searches all five at once.' },
          { title: 'Qualifying is manual', body: 'You open each profile, read the bio, eyeball the audience, guess if they fit. There\'s no scoring layer.' },
          { title: 'Outreach is a graveyard', body: 'Generic DMs. No tracking. No follow-up reminders. Replies land in a personal inbox and disappear.' },
        ],
      }},
      { layout: 'bigStat', content: {
        eyebrow: 'The cost of bad outreach',
        stat: '< 5%',
        statSize: 280,
        statLabel: 'Average reply rate on cold creator DMs sent via existing tools.',
        body: 'When 95% of your messages go to /dev/null, the right creators never even know you exist. The problem is targeting and follow-through — not budget.',
        source: 'Industry-reported open and reply benchmarks, 2025–2026',
      }},
      { layout: 'quote', content: {
        quote: 'I spent four hours yesterday writing one outreach email — and three of those hours were just finding someone who matched what we needed.',
        quoteSize: 30,
        attribution: 'Every founder doing this manually',
        attributionSub: 'Paraphrased from dozens of conversations',
      }},
      { layout: 'diagonal', content: {
        eyebrow: 'Why this matters',
        title: 'The bottleneck isn\'t creators. It\'s the workflow to reach them.',
        body: 'There are millions of public creators on five platforms. Founders are bottlenecked not by supply, but by every step required to pick the right one and start the conversation. Workflow is the constraint.',
        callout: 'Wrong\ncreators.\nWrong tools.\nWrong replies.',
      }},
      { layout: 'bento', content: {
        eyebrow: 'The Problem',
        title: 'Three broken steps. Stacked. Every day.',
        cards: [
          { title: 'EVERY OUTREACH WORKFLOW TODAY', headline: 'Fragmented. Manual. Untracked.', body: 'Five platforms, five tabs, one spreadsheet, no CRM, no follow-ups, no analytics. The work is real but the system is duct tape.' },
          { title: 'Time lost', body: '3–4 hours per ten creators sourced.' },
          { title: 'Quality lost', body: 'Reply rates under 5% on generic DMs.' },
          { title: 'Signal lost', body: 'No CRM means no learning loop.' },
        ],
      }},
    ],
  },

  // ──────────────────────────────────────────────────────────────────
  // 3. PAIN AT SCALE
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'painScale',
    title: 'Pain at scale',
    variations: [
      { layout: 'hero', content: {
        eyebrow: 'Pain at Scale',
        title: 'A small problem per outreach. A massive problem per quarter.',
        subtitle: 'One creator costs 30 minutes. A real campaign needs 200. Two months of one person\'s time, for work software should be doing.',
        titleSize: 50,
      }},
      { layout: 'split', content: {
        eyebrow: 'The Math',
        title: 'Two hundred creators. Six thousand minutes. One quarter, gone.',
        body: 'Even at thirty minutes per creator — sourcing, qualifying, contacting, logging — a single campaign eats one hundred hours of focus work. That\'s before reply handling, follow-ups, or measurement.',
        stat: '200',
        statLabel: 'Creators in a typical B2B campaign — and the moment manual workflows start to collapse.',
      }},
      { layout: 'grid3', content: {
        eyebrow: 'Where it breaks',
        title: 'Manual workflows scale linearly. Pipelines don\'t.',
        subtitle: 'Every campaign requires the same setup, the same spreadsheets, the same dead messages. Nothing compounds.',
        cards: [
          { title: '10 creators', body: 'Tolerable. You handle it in an afternoon. You don\'t feel the pain yet.' },
          { title: '50 creators', body: 'Painful. You build a spreadsheet, then ignore half the rows. Quality drops.' },
          { title: '200 creators', body: 'Breakdown. You hire a contractor or you skip the campaign entirely.' },
        ],
      }},
      { layout: 'bigStat', content: {
        eyebrow: 'Per quarter',
        stat: '100h',
        statSize: 280,
        statLabel: 'One person, full-time, for two and a half weeks.',
        body: 'That\'s the operational cost of running real creator outreach manually — without tooling. And it\'s the cost before you even count reply rates, missed follow-ups, or learning curves on tools that don\'t exist.',
      }},
      { layout: 'quote', content: {
        quote: 'We tried scaling creator outreach with a junior hire. By month two she was a glorified human spreadsheet. We weren\'t getting better — we were just running out of time slower.',
        quoteSize: 28,
        attribution: 'B2B SaaS founder, 50-person team',
        attributionSub: 'Customer discovery interview, March 2026',
      }},
      { layout: 'diagonal', content: {
        eyebrow: 'The Scaling Wall',
        title: 'Past fifty creators, manual outreach silently breaks.',
        body: 'Quality drops as volume rises. Spreadsheets stop being a source of truth. Reply rates fall. No one notices until a quarter ends and the pipeline is empty. The work felt real — the output never showed up.',
        callout: 'Fifty\ncreators.\nThe wall\neveryone\nhits.',
      }},
      { layout: 'bento', content: {
        eyebrow: 'At scale',
        title: 'The hidden quarterly cost of the workflow no one designed.',
        cards: [
          { title: 'PAIN AT SCALE', headline: '$15,000+ per campaign, mostly in salaried time.', body: 'At a $75K-fully-loaded BD hire, 100 hours of manual creator outreach costs roughly $3,750 in wages alone — repeated four times a year.' },
          { title: 'Reply rate', body: 'Falls from ~8% on careful outreach to ~2% on copy-pasted blasts.' },
          { title: 'Bench depth', body: 'Most teams can\'t spare one person for 100 hours. So they don\'t run the campaign.' },
          { title: 'Learning', body: 'Without a CRM, none of the work compounds into a system.' },
        ],
      }},
    ],
  },

  // ──────────────────────────────────────────────────────────────────
  // 4. WHY EXISTING TOOLS FAIL
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'toolsFail',
    title: 'Why existing tools fail',
    variations: [
      { layout: 'hero', content: {
        eyebrow: 'The Tooling Gap',
        title: 'Influencer platforms aren\'t built for B2B. CRMs aren\'t built for creators.',
        subtitle: 'Heepsy, Modash, and HypeAuditor are built for consumer brand campaigns. HubSpot, Pipedrive, and Attio are built for SDRs working a B2B funnel. No tool sits in the middle — where founders actually live.',
        titleSize: 42,
      }},
      { layout: 'split', content: {
        eyebrow: 'Two Categories. Neither fits.',
        title: 'B2B founders sit in a tooling gap nobody is serving.',
        body: 'Existing influencer platforms over-index on Instagram fashion creators and seven-figure budgets. Existing CRMs treat creators as random contacts with no enrichment, no platform context, and no native outreach. The shape of B2B creator outreach is its own product category.',
        callout: 'Influencer\ntools\n+\nB2B CRMs\n=\nneither fits.',
      }},
      { layout: 'grid3', content: {
        eyebrow: 'What\'s broken',
        title: 'Three reasons every existing tool fails this workflow.',
        cards: [
          { title: 'Wrong audience', body: 'Built for enterprise brand teams running $100K+ campaigns — not founders sending 200 personalized messages.' },
          { title: 'Wrong platform mix', body: 'Most tools cover Instagram and TikTok only. B2B creator outreach happens on LinkedIn, YouTube, and X.' },
          { title: 'Wrong workflow', body: 'No qualification layer. No native send. No CRM. Just a creator directory with an export button.' },
        ],
      }},
      { layout: 'bigStat', content: {
        eyebrow: 'Pricing reality',
        stat: '$10K',
        statSize: 280,
        statLabel: 'Average minimum annual contract for incumbent influencer platforms.',
        body: 'Heepsy starts around $89/month for limited features. Modash starts around $300/month. Real B2B-grade platforms are $10K+/year and built for enterprise brand teams. Nothing in the middle serves the founder running this work themselves.',
      }},
      { layout: 'quote', content: {
        quote: 'We evaluated four influencer platforms. Every one of them was built for someone planning a Sephora campaign — not someone trying to find SaaS reviewers on YouTube.',
        quoteSize: 28,
        attribution: 'Founder, early-stage B2B SaaS',
        attributionSub: 'Customer discovery, April 2026',
      }},
      { layout: 'diagonal', content: {
        eyebrow: 'The Gap',
        title: 'Built for the wrong buyer. Priced for the wrong budget.',
        body: 'Every existing creator tool was designed around enterprise brand marketers. The founder running B2B outreach themselves — with a $0–$500/month tool budget and a need for LinkedIn-first workflows — has been ignored.',
        callout: 'Tools for\nthem.\nNot tools\nfor us.',
      }},
      { layout: 'bento', content: {
        eyebrow: 'Why tools fail',
        title: 'Three categories. None of them fit the workflow.',
        cards: [
          { title: 'WHAT EXISTS TODAY', headline: 'Influencer platforms or generic CRMs — never the middle.', body: 'Heepsy, Modash, and HypeAuditor are built for brand teams. HubSpot, Pipedrive, and Attio are built for SDRs. B2B creator outreach is a third workflow no one is building.' },
          { title: 'Influencer platforms', body: 'Wrong buyer. Wrong platforms. Priced for enterprise brand budgets.' },
          { title: 'Generic CRMs', body: 'No creator data. No native DM. No public-platform search.' },
          { title: 'Spreadsheets', body: 'What everyone actually uses. Slow, brittle, no learning.' },
        ],
      }},
    ],
  },

  // ──────────────────────────────────────────────────────────────────
  // 5. INTRODUCING CREATOR OUTREACH
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'intro',
    title: 'Introducing Creator Outreach',
    variations: [
      { layout: 'hero', content: {
        eyebrow: 'Introducing',
        title: 'Creator Outreach.',
        subtitle: 'A single workspace for finding, scoring, and reaching creators across YouTube, Instagram, TikTok, X, and LinkedIn — built for the founder doing the work.',
        titleSize: 96,
      }},
      { layout: 'split', content: {
        eyebrow: 'The Product',
        title: 'One tool. Five platforms. Built for the founder.',
        body: 'Creator Outreach unifies discovery, AI qualification, native outreach, and a creator CRM into a single workspace. It replaces the spreadsheets, browser tabs, and disconnected DMs that every team patches together today.',
        bullets: [
          'Unified search across YouTube, Instagram, TikTok, X, LinkedIn',
          'AI fit score against your ICP, in seconds',
          'Native send via Gmail, IG, LinkedIn — with reply tracking',
          'A purpose-built CRM that captures the full creator lifecycle',
        ],
      }},
      { layout: 'grid3', content: {
        eyebrow: 'What we built',
        title: 'Three core surfaces. One workflow.',
        subtitle: 'Each surface compounds with the next — and the whole is the product.',
        cards: [
          { title: 'Discovery', body: 'Search across five platforms from one query. Surface every public creator who fits your criteria.' },
          { title: 'Qualification', body: 'AI fit score reads each creator\'s public footprint and rates them against your ICP. Sort by score, not by guesswork.' },
          { title: 'Outreach + CRM', body: 'Send through your own Gmail, IG, or LinkedIn — and we log every reply, follow-up, and status change automatically.' },
        ],
      }},
      { layout: 'bigStat', content: {
        eyebrow: 'The Numbers',
        stat: '5',
        statSize: 360,
        statLabel: 'Platforms. One workflow. Built into one tool.',
        body: 'YouTube. Instagram. TikTok. X. LinkedIn. The five public platforms where B2B-relevant creators actually live — finally searchable from one place.',
      }},
      { layout: 'quote', content: {
        quote: 'Creator Outreach is what happens when the person who burned out doing this work for a year sits down and rebuilds it as software.',
        quoteSize: 32,
        attribution: 'Product positioning',
        attributionSub: 'Operator-built, not VC-prompted.',
      }},
      { layout: 'diagonal', content: {
        eyebrow: 'Introducing',
        title: 'The B2B creator workflow, finally as software.',
        body: 'Everything an operator was doing in 12 browser tabs and one fraying spreadsheet — now one fluent workflow. Built around how the work actually happens, not how an analyst thinks it should.',
        callout: 'Creator\nOutreach.\nv1.0\nlive now.',
      }},
      { layout: 'bento', content: {
        eyebrow: 'The product',
        title: 'Built around the four moments of creator outreach.',
        cards: [
          { title: 'CREATOR OUTREACH', headline: 'Discover. Qualify. Reach. Track.', body: 'Four moments in every campaign — and the first tool that handles all four in the same workspace, with the same data model.' },
          { title: 'Discover', body: 'Search 5 platforms from one query bar.' },
          { title: 'Qualify', body: 'AI fit score against your ICP.' },
          { title: 'Reach + Track', body: 'Native send. CRM that captures the lifecycle.' },
        ],
      }},
    ],
  },

  // ──────────────────────────────────────────────────────────────────
  // 6. HOW IT WORKS (3 STEPS)
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'howItWorks',
    title: 'How it works',
    variations: [
      { layout: 'hero', content: {
        eyebrow: 'How It Works',
        title: 'Three steps. Six minutes. Every campaign.',
        subtitle: 'Describe who you want, let AI score the matches, send through your own inbox. Then the CRM does the rest.',
        titleSize: 56,
      }},
      { layout: 'split', content: {
        eyebrow: 'The Workflow',
        title: 'From a one-line search to a sent email — in six minutes.',
        body: 'Type the kind of creator you\'re looking for. We search five platforms and apply your scoring criteria. Pick the matches you want to reach. Send through your own Gmail, IG, or LinkedIn. The CRM captures every reply, status, and next action without you lifting a finger.',
        stat: '6 min',
        statLabel: 'Median time from a new search to first send. Down from 4+ hours.',
      }},
      { layout: 'grid3', content: {
        eyebrow: 'How it works',
        title: 'Three steps. Built to compound.',
        subtitle: 'Each step feeds the next — so a workflow becomes a system.',
        cards: [
          { title: 'Search', body: 'One query bar. Five platforms. Public creators only. Filter by audience size, engagement, language, and niche.' },
          { title: 'Score', body: 'AI rates every result 0–100 against your ICP criteria. Sort by score. Skip the bottom half. Open the top ten.' },
          { title: 'Send', body: 'Native compose in Gmail, IG, LinkedIn. The CRM logs the send, watches for replies, and reminds you when to follow up.' },
        ],
      }},
      { layout: 'bigStat', content: {
        eyebrow: 'Time to first send',
        stat: '6:42',
        statSize: 280,
        statLabel: 'Median minutes from new search to first message sent — across 47 active users in May 2026.',
        body: 'The same workflow used to take 3–4 hours. The compression isn\'t a feature; it\'s the entire reason the product exists.',
      }},
      { layout: 'quote', content: {
        quote: 'I described my ICP in one sentence, opened the top five scored creators, and sent personalized emails before my coffee finished brewing.',
        quoteSize: 30,
        attribution: 'Beta user',
        attributionSub: 'Week-one onboarding feedback',
      }},
      { layout: 'diagonal', content: {
        eyebrow: 'The three steps',
        title: 'Search. Score. Send.',
        body: 'Three verbs that describe the work, end to end. Search across five platforms. Score against your ICP. Send through your own inbox. The product turns a fragmented workflow into one motion.',
        callout: 'Search.\nScore.\nSend.',
      }},
      { layout: 'bento', content: {
        eyebrow: 'How it works',
        title: 'A single motion across five platforms.',
        cards: [
          { title: 'STEP-BY-STEP', headline: 'Three steps. One workspace.', body: 'Describe your ideal creator. We search five platforms. AI ranks the results. You send through your own inbox. The CRM captures the rest.' },
          { title: '1. Search', body: 'Five platforms. One query.' },
          { title: '2. Score', body: 'AI fit score against your ICP.' },
          { title: '3. Send', body: 'Native compose, native track.' },
        ],
      }},
    ],
  },

  // ──────────────────────────────────────────────────────────────────
  // 7. 5-PLATFORM SEARCH
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'search',
    title: '5-platform search',
    variations: [
      { layout: 'hero', content: {
        eyebrow: 'Feature · 5-Platform Search',
        title: 'Search five platforms. From one query bar.',
        subtitle: 'YouTube, Instagram, TikTok, X, LinkedIn — searchable as one. Public data, structured, normalized, and yours.',
        titleSize: 58,
      }},
      { layout: 'split', content: {
        eyebrow: 'Discovery',
        title: 'YouTube. Instagram. TikTok. X. LinkedIn. Searched together.',
        body: 'Type a one-line description. We search every platform in parallel, deduplicate cross-platform creators, and return a single ranked list. No more switching tabs, no more rebuilding the same query in five different UIs.',
        bullets: [
          'Parallel queries across all five platforms',
          'Cross-platform creator deduplication',
          'Filters: audience size, engagement, language, geography',
          'Public-data only — fully compliant',
        ],
      }},
      { layout: 'grid3', content: {
        eyebrow: 'Why five',
        title: 'Different creators live on different platforms.',
        subtitle: 'B2B-relevant creators don\'t cluster. The best ones are split across surfaces. So the search has to be split too.',
        cards: [
          { title: 'YouTube + X', body: 'Where B2B SaaS reviewers and technical influencers concentrate. Long-form trust + breaking-news distribution.' },
          { title: 'LinkedIn', body: 'Where operator-creators publish. Where founders, sales leaders, and engineers build their audience.' },
          { title: 'Instagram + TikTok', body: 'Where short-form, consumer-adjacent, and design-focused creators live. Underrated for B2B SaaS that touches design.' },
        ],
      }},
      { layout: 'bigStat', content: {
        eyebrow: 'Coverage',
        stat: '5',
        statSize: 360,
        statLabel: 'Platforms supported at v1.0. Native search across each.',
        body: 'The only tool in our category that covers YouTube, Instagram, TikTok, X, and LinkedIn in a single unified search. Most competitors cover two or three.',
      }},
      { layout: 'quote', content: {
        quote: 'I didn\'t know we had three of the right creators already following us on LinkedIn until the unified search surfaced them next to our YouTube targets.',
        quoteSize: 30,
        attribution: 'Beta user — B2B SaaS founder',
        attributionSub: 'On the value of cross-platform discovery',
      }},
      { layout: 'diagonal', content: {
        eyebrow: 'Discovery',
        title: 'One query bar. Five platforms. Public data only.',
        body: 'No scraping shortcuts, no gray-area data resale. We use each platform\'s public surface to find creators who have chosen to be public. Then we structure that data into a workflow that respects both creators and our customers.',
        callout: 'Five\nplatforms.\nOne\nquery.',
      }},
      { layout: 'bento', content: {
        eyebrow: 'Unified search',
        title: 'The first tool to search creators across five platforms at once.',
        cards: [
          { title: '5-PLATFORM SEARCH', headline: 'Search all of them. Get one ranked list.', body: 'YouTube, Instagram, TikTok, X, LinkedIn — searched in parallel, deduplicated, and returned as a single creator list ranked by your fit score.' },
          { title: 'YouTube', body: 'Long-form trust. Technical reviewers.' },
          { title: 'LinkedIn', body: 'Operator-creators and B2B audiences.' },
          { title: 'IG · TikTok · X', body: 'Short-form, consumer-adjacent, distribution.' },
        ],
      }},
    ],
  },

  // ──────────────────────────────────────────────────────────────────
  // 8. AI FIT SCORE
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'aiScore',
    title: 'AI fit score',
    variations: [
      { layout: 'hero', content: {
        eyebrow: 'Feature · AI Fit Score',
        title: 'Every creator. Rated 0–100. Against your ICP.',
        subtitle: 'Stop reading 80 bios to find the one that matches. Describe what you\'re looking for once; AI scores every result against your criteria.',
        titleSize: 50,
      }},
      { layout: 'split', content: {
        eyebrow: 'Qualification',
        title: 'AI does the qualification step you were doing in your head.',
        body: 'You used to open every creator profile, read the bio, check the recent posts, and form an instinctive yes-or-no. The AI fit score does that systematically — reading each creator\'s public footprint and rating them 0–100 against the criteria you defined.',
        stat: '0–100',
        statLabel: 'Every creator scored on the same scale. Sortable. Filterable. Explainable.',
      }},
      { layout: 'grid3', content: {
        eyebrow: 'How scoring works',
        title: 'The score is structured, not a vibe check.',
        subtitle: 'Each score breaks down into named components — so you can trust it and tune it.',
        cards: [
          { title: 'Audience signal', body: 'Audience size, engagement, retention, growth trajectory. Each platform\'s public signal, normalized.' },
          { title: 'Content fit', body: 'Topic match, post cadence, content seriousness, language. Compared to the ICP you described.' },
          { title: 'Brand fit', body: 'Tone alignment, audience overlap with your existing customers, signal of B2B vs. consumer focus.' },
        ],
      }},
      { layout: 'bigStat', content: {
        eyebrow: 'Time saved',
        stat: '95%',
        statSize: 280,
        statLabel: 'Reduction in profile-by-profile reading time vs. manual qualification.',
        body: 'Instead of opening 200 creator profiles to find the right 10, you open the top 10 ranked by AI fit score. The remaining 190 get filtered without losing the long tail — they\'re still in your CRM, just at the bottom.',
      }},
      { layout: 'quote', content: {
        quote: 'The score gave me explicit permission to skip 80% of the results — and the 20% I opened were almost always right.',
        quoteSize: 30,
        attribution: 'Beta user — design SaaS founder',
        attributionSub: 'On the value of structured qualification',
      }},
      { layout: 'diagonal', content: {
        eyebrow: 'AI fit score',
        title: 'Trustworthy because it\'s explained.',
        body: 'Every score is broken into audience, content, and brand fit components — so you can see why a creator scored 87 and what would push them higher. No black-box ranking; every score is auditable.',
        callout: 'Score:\n87/100\n\nWhy?\nShown.',
      }},
      { layout: 'bento', content: {
        eyebrow: 'AI fit score',
        title: 'The qualification layer that didn\'t exist before.',
        cards: [
          { title: 'AI FIT SCORE', headline: '0–100, explained, against your ICP.', body: 'Every creator in your search gets a score from 0 to 100, with named sub-scores for audience, content fit, and brand alignment. Trust the top of the list and ignore the bottom.' },
          { title: 'Audience signal', body: 'Size, engagement, growth, retention.' },
          { title: 'Content fit', body: 'Topic, cadence, language, seriousness.' },
          { title: 'Brand alignment', body: 'Tone, audience overlap, focus.' },
        ],
      }},
    ],
  },

  // ──────────────────────────────────────────────────────────────────
  // 9. NATIVE OUTREACH + CRM
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'outreach',
    title: 'Native outreach + CRM',
    variations: [
      { layout: 'hero', content: {
        eyebrow: 'Feature · Outreach + CRM',
        title: 'Send through your own inbox. Track every reply automatically.',
        subtitle: 'Gmail compose, Instagram DM, LinkedIn message — all native. Replies land in the CRM. Status updates itself. You just write the message.',
        titleSize: 46,
      }},
      { layout: 'split', content: {
        eyebrow: 'Outreach',
        title: 'Your inbox. Our tracking. Their reply.',
        body: 'Creator Outreach never proxies your messages through a generic shared sender. Every outreach goes through your own Gmail compose window, your own IG account, or your own LinkedIn — with our CRM watching for replies, follow-ups, and status changes silently in the background.',
        bullets: [
          'Native Gmail compose with template variables',
          'Instagram and LinkedIn DM via your own accounts',
          'Reply detection and status auto-update',
          'Follow-up reminders surfaced at the right cadence',
        ],
      }},
      { layout: 'grid3', content: {
        eyebrow: 'The CRM, built for creators',
        title: 'Three CRM surfaces tuned for the lifecycle.',
        subtitle: 'Not a generic Pipedrive lookalike — a CRM that knows what a creator is and what stage means in this context.',
        cards: [
          { title: 'Pipeline', body: 'Kanban view by stage: Targeted → Contacted → Replied → Negotiating → Live → Done. Drag-and-drop, or let replies auto-advance.' },
          { title: 'Profile', body: 'Every creator\'s full history: posts seen, messages sent, replies, notes, tags, and links to their public platforms.' },
          { title: 'Follow-ups', body: 'Auto-scheduled reminders for contacts who haven\'t replied. Surfaces ghosting cleanly before it costs you.' },
        ],
      }},
      { layout: 'bigStat', content: {
        eyebrow: 'Reply tracking',
        stat: '100%',
        statSize: 280,
        statLabel: 'Of replies captured and matched to the original outreach.',
        body: 'No more replies lost in a personal inbox or a forgotten DM thread. Every reply gets linked back to the original outreach automatically — so the CRM is always accurate, and follow-up decisions are always informed.',
      }},
      { layout: 'quote', content: {
        quote: 'I used to forget which creators replied. Now I forget that I have a CRM at all — it just updates itself while I work.',
        quoteSize: 30,
        attribution: 'Beta user',
        attributionSub: 'On unattended status tracking',
      }},
      { layout: 'diagonal', content: {
        eyebrow: 'Outreach + CRM',
        title: 'The CRM disappears into the workflow.',
        body: 'You send a message from your own Gmail. You see a reply in your own inbox. In the background, the CRM has captured the send, matched the reply, advanced the status, and scheduled the right follow-up. You never had to log anything.',
        callout: 'Send.\nReply.\nLog itself.',
      }},
      { layout: 'bento', content: {
        eyebrow: 'Outreach + CRM',
        title: 'The send + the system, finally in one place.',
        cards: [
          { title: 'NATIVE SEND + CRM', headline: 'Send through your inbox. Track in our CRM.', body: 'Gmail, Instagram, LinkedIn — all native. Replies land in the CRM, status auto-updates, follow-ups schedule themselves. The CRM disappears into the workflow.' },
          { title: 'Send', body: 'Native compose in your own accounts.' },
          { title: 'Track', body: 'Replies matched to outreach automatically.' },
          { title: 'Follow up', body: 'Reminders surfaced at the right cadence.' },
        ],
      }},
    ],
  },

  // ──────────────────────────────────────────────────────────────────
  // 10. CUSTOM ANALYTICS
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'analytics',
    title: 'Custom analytics',
    variations: [
      { layout: 'hero', content: {
        eyebrow: 'Feature · Analytics',
        title: 'Every campaign learns. Every metric, yours.',
        subtitle: 'Reply rate by platform. Cost per qualified creator. Time-to-first-reply. The metrics no other tool tracks — built around how you actually measure success.',
        titleSize: 48,
      }},
      { layout: 'split', content: {
        eyebrow: 'Analytics',
        title: 'The metrics nobody else builds — because nobody else owns the whole workflow.',
        body: 'Because Creator Outreach captures discovery, scoring, send, and reply in one tool, we can measure things no other system can: reply rate by AI score band, time-to-reply by platform, cost-per-qualified-creator by campaign. Closed-loop analytics, finally.',
        callout: '"Reply rate\nby fit-score\nband."\n\nThe metric\nno one\nelse owns.',
      }},
      { layout: 'grid3', content: {
        eyebrow: 'Three core metrics',
        title: 'Three numbers that change how you run campaigns.',
        subtitle: 'Each captured automatically. Each previously impossible to measure.',
        cards: [
          { title: 'Reply rate by score', body: 'Are your high-scored creators actually replying more? If not, your ICP needs tuning. We surface this every week.' },
          { title: 'Time-to-first-reply', body: 'Median hours from send to first reply, by platform. Tells you which platforms are alive and which are dead air.' },
          { title: 'Cost per qualified creator', body: 'Total operator hours ÷ creators who replied with intent. The metric you couldn\'t measure before, suddenly trivial to track.' },
        ],
      }},
      { layout: 'bigStat', content: {
        eyebrow: 'Closed-loop',
        stat: '14',
        statSize: 280,
        statLabel: 'Distinct metrics tracked automatically across every campaign.',
        body: 'Per-platform reply rates, per-template engagement, score-band conversion, follow-up timing impact, and more — all captured passively because the entire workflow lives in one tool. No dashboard configuration. No spreadsheet exports.',
      }},
      { layout: 'quote', content: {
        quote: 'I finally know that LinkedIn replies 3x faster than Instagram for my ICP. Two months of pattern-matching done in one chart.',
        quoteSize: 30,
        attribution: 'Beta user',
        attributionSub: 'On closed-loop analytics',
      }},
      { layout: 'diagonal', content: {
        eyebrow: 'Custom analytics',
        title: 'Built around how creator outreach actually compounds.',
        body: 'The point isn\'t pretty charts. The point is that every campaign teaches the next campaign — and that compounding only happens if the data structure is right from day one. We designed for the metrics first, then built the surfaces around them.',
        callout: 'Data\ncompounds.\nDecks\ndon\'t.',
      }},
      { layout: 'bento', content: {
        eyebrow: 'Analytics',
        title: 'The metrics other tools can\'t measure — because they don\'t own the workflow.',
        cards: [
          { title: 'CUSTOM ANALYTICS', headline: 'Closed-loop, automatic, opinionated.', body: 'Reply rate by fit-score band. Time-to-first-reply by platform. Cost per qualified creator. Metrics impossible without owning discovery, send, and reply in one tool.' },
          { title: 'By score', body: 'Which fit-score bands actually convert?' },
          { title: 'By platform', body: 'Which platforms reply fastest for your ICP?' },
          { title: 'By template', body: 'Which messages earn replies, which earn silence?' },
        ],
      }},
    ],
  },

  // ──────────────────────────────────────────────────────────────────
  // 11. COMPETITIVE LANDSCAPE
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'competition',
    title: 'Competitive landscape',
    variations: [
      { layout: 'hero', content: {
        eyebrow: 'Competitive Landscape',
        title: 'Two categories. Two ends of the market. One open middle.',
        subtitle: 'Influencer platforms serve enterprise brand teams. Generic CRMs serve B2B sales. The founder running B2B creator outreach lives between them — and that\'s our wedge.',
        titleSize: 46,
      }},
      { layout: 'split', content: {
        eyebrow: 'The Map',
        title: 'Where we sit between two well-funded categories.',
        body: 'Heepsy, Modash, HypeAuditor, Influencity, and CreatorIQ optimize for enterprise brand campaigns with five- and six-figure annual budgets. HubSpot, Pipedrive, Attio, and Apollo optimize for B2B SDR pipelines with no creator context. We sit in the middle: B2B-relevant creators, founder-budget tooling, native cross-platform workflow.',
        bullets: [
          'Influencer platforms — wrong buyer, wrong platforms, wrong price',
          'Generic CRMs — no creator data, no native send, no platform context',
          'Sales engagement tools — built for SDRs, not founders',
          'Creator Outreach — the middle, finally built',
        ],
      }},
      { layout: 'grid3', content: {
        eyebrow: 'Three competitive zones',
        title: 'Each zone misses the founder running B2B creator outreach.',
        cards: [
          { title: 'Influencer platforms', body: 'Heepsy, Modash, HypeAuditor. Built for brand marketers. Consumer-focused. $10K+ ACV. Wrong shape entirely.' },
          { title: 'Generic CRMs', body: 'HubSpot, Pipedrive, Attio. Strong pipeline tools. No creator data, no native outreach, no platform intelligence.' },
          { title: 'Sales engagement', body: 'Outreach, Apollo, Salesloft. Built for SDR teams sending 1,000 cold emails. Wrong workflow for creator partnerships.' },
        ],
      }},
      { layout: 'bigStat', content: {
        eyebrow: 'Pricing gap',
        stat: '$0–$10K',
        statSize: 220,
        statLabel: 'The pricing gap where no competitor exists.',
        body: 'Influencer platforms start around $300/month for limited coverage and jump to $10K+/year. Generic CRMs cost $50–$200/month but lack every creator-specific feature. Founders working in the $20–$500/month tool budget bracket have no purpose-built option.',
      }},
      { layout: 'quote', content: {
        quote: 'We evaluated nine tools and built our own spreadsheet anyway. The space between Modash and HubSpot just wasn\'t served.',
        quoteSize: 30,
        attribution: 'Series A founder',
        attributionSub: 'Customer discovery, April 2026',
      }},
      { layout: 'diagonal', content: {
        eyebrow: 'The wedge',
        title: 'The open middle: B2B-relevant creators × founder-budget tools.',
        body: 'Every existing tool serves one corner of the market — enterprise brand marketers or B2B SDR teams. Nobody serves the founder running creator-led growth on a $200/month tool budget. That gap is our wedge — and it\'s the largest underserved segment in B2B outreach.',
        callout: 'The\nmiddle.\nFinally\nbuilt.',
      }},
      { layout: 'bento', content: {
        eyebrow: 'Landscape',
        title: 'Where we sit. Why no one else is here.',
        cards: [
          { title: 'COMPETITIVE LANDSCAPE', headline: 'B2B creator outreach is its own category.', body: 'Influencer platforms own the enterprise brand market. Generic CRMs own B2B sales pipelines. Sales engagement tools own SDR cold email. None of them own the founder running B2B creator outreach manually today.' },
          { title: 'Influencer tools', body: 'Heepsy. Modash. HypeAuditor. Wrong buyer.' },
          { title: 'Generic CRMs', body: 'HubSpot. Pipedrive. Attio. No creator layer.' },
          { title: 'Open middle', body: 'B2B creators × founder budget. Ours.' },
        ],
      }},
    ],
  },

  // ──────────────────────────────────────────────────────────────────
  // 12. PRICING
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'pricing',
    title: 'Pricing',
    variations: [
      { layout: 'hero', content: {
        eyebrow: 'Pricing',
        title: 'Honest pricing. Built for founders, not enterprise brands.',
        subtitle: 'Two paid plans. No quotas you can\'t hit. No "contact sales" tax. Annual saves 20%.',
        titleSize: 50,
      }},
      { layout: 'split', content: {
        eyebrow: 'How we price',
        title: 'Two plans. Clear value. No hidden gates.',
        body: 'Pro is for the founder running creator outreach themselves. Scale is for the team running multiple campaigns in parallel. Both are full product — we don\'t hide features behind enterprise sales. Annual saves 20% and we offer the first 10 customers $20/mo locked forever.',
        bullets: [
          'Pro — $39/mo — full product, 1 seat',
          'Scale — $99/mo — 5 seats, advanced analytics',
          'Early-customer discount: first 10 customers, $20/mo locked',
          'Annual saves 20%',
        ],
      }},
      { layout: 'grid3', content: {
        eyebrow: 'Three plans · One product',
        title: 'Every plan is the full product. No feature gates.',
        cards: [
          { title: 'Pro · $39/mo', body: '1 seat. Unlimited searches. Full CRM. Native send. AI fit score. Designed for the solo founder doing outreach.' },
          { title: 'Scale · $99/mo', body: '5 seats. Advanced analytics. Shared CRM views. For the small team running creator partnerships in parallel.' },
          { title: 'Annual · –20%', body: 'Pay annually, save 20%. Pro becomes $31/mo. Scale becomes $79/mo. Same product, lower price, less friction.' },
        ],
      }},
      { layout: 'bigStat', content: {
        eyebrow: 'Pricing anchor',
        stat: '$39',
        statSize: 360,
        statLabel: 'per month, all-in, for the full product.',
        body: 'Compared to Modash ($300/mo entry), HypeAuditor ($400/mo entry), and CreatorIQ ($10K+/yr), Creator Outreach is 8–25x cheaper at entry — for a product purpose-built for the workflow they don\'t serve.',
      }},
      { layout: 'quote', content: {
        quote: 'I signed up at $39/month, hit ROI in week one. The pricing is a magnet for founders who would never even take a Modash demo call.',
        quoteSize: 30,
        attribution: 'Beta customer',
        attributionSub: 'Week-one conversion feedback',
      }},
      { layout: 'diagonal', content: {
        eyebrow: 'Pricing',
        title: '$39 to start. $99 to scale. Annual saves 20%.',
        body: 'Founder-friendly pricing isn\'t a gimmick — it\'s a market signal. The buyers we serve have $200–$500/month total tool budgets. We price to clear that bar with room left over for the next tool they\'ll need.',
        callout: '$39\n/mo\n\nFull\nproduct.',
      }},
      { layout: 'bento', content: {
        eyebrow: 'Pricing',
        title: 'Honest, simple, founder-priced.',
        cards: [
          { title: 'PRICING', headline: '$39 Pro. $99 Scale. Annual saves 20%.', body: 'Two plans. Both are the full product. No feature gates. First 10 customers get $20/mo locked forever as a thank-you for being early.' },
          { title: 'Pro', body: '$39/mo · 1 seat · full product' },
          { title: 'Scale', body: '$99/mo · 5 seats · advanced analytics' },
          { title: 'Early-bird', body: 'First 10 customers — $20/mo locked' },
        ],
      }},
    ],
  },

  // ──────────────────────────────────────────────────────────────────
  // 13. WHO IT'S FOR
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'who',
    title: 'Who it\'s for',
    variations: [
      { layout: 'hero', content: {
        eyebrow: 'Who It\'s For',
        title: 'Founders. Partnerships teams. Growth operators.',
        subtitle: 'Anyone who has ever opened a spreadsheet, switched to a browser tab, and thought "there has to be a better way to do this."',
        titleSize: 52,
      }},
      { layout: 'split', content: {
        eyebrow: 'ICP',
        title: 'Three buyer types. One workflow.',
        body: 'Series A–C B2B SaaS founders running early creator partnerships themselves. Partnerships managers at 50–500 person companies running 50+ outreaches per month. Growth operators and contractors doing creator work across multiple clients. All three share the same workflow shape — and the same gap in tooling.',
        callout: '"The work\nis real.\nThe tools\naren\'t."\n\n— Every buyer\nin our ICP',
      }},
      { layout: 'grid3', content: {
        eyebrow: 'Three buyer types',
        title: 'Each buyer feels the same pain — at a different scale.',
        cards: [
          { title: 'Founders', body: 'Series A–C B2B SaaS, doing early creator partnerships themselves. Need leverage, not a sales process.' },
          { title: 'Partnerships managers', body: '50–500 person companies, running 50+ creator outreaches per month. Need scale and CRM, not a spreadsheet.' },
          { title: 'Growth operators', body: 'Contractors and fractional growth leads serving 3–5 clients. Need a workflow they can run across accounts.' },
        ],
      }},
      { layout: 'bigStat', content: {
        eyebrow: 'TAM signal',
        stat: '40K',
        statSize: 280,
        statLabel: 'Series A–C B2B SaaS companies in the US alone.',
        body: 'Every one of them has the same creator outreach problem. Every one of them has the same workflow gap. Even a 2% conversion rate to a $99 Scale plan represents a $9.5M ARR opportunity — before we count partnerships managers, growth operators, or international expansion.',
      }},
      { layout: 'quote', content: {
        quote: 'This is the tool I would have built for myself two years ago when I was doing this manually. That\'s the entire ICP statement.',
        quoteSize: 30,
        attribution: 'Dylan Meehan',
        attributionSub: 'Founder, Creator Outreach',
      }},
      { layout: 'diagonal', content: {
        eyebrow: 'Who it\'s for',
        title: 'The operator doing this work today — without the tool.',
        body: 'You already do creator outreach. You already have a spreadsheet. You already know the work matters. You\'re missing the workflow that makes it leverageable. That\'s the entire ICP, in one sentence.',
        callout: 'Already\ndoing\nthe work.\nMissing\nthe tool.',
      }},
      { layout: 'bento', content: {
        eyebrow: 'ICP',
        title: 'Three buyer types. One workflow gap.',
        cards: [
          { title: 'WHO IT\'S FOR', headline: 'B2B operators running creator outreach manually today.', body: 'Series A–C founders, partnerships managers at 50–500 person companies, and growth contractors serving multiple accounts. All three share the same workflow gap.' },
          { title: 'Founders', body: 'Series A–C B2B SaaS. Need leverage.' },
          { title: 'Partnerships', body: '50–500 ppl orgs. Need CRM + scale.' },
          { title: 'Growth ops', body: 'Multi-client contractors. Need a system.' },
        ],
      }},
    ],
  },

  // ──────────────────────────────────────────────────────────────────
  // 14. WHY WE WIN
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'whyWin',
    title: 'Why we win',
    variations: [
      { layout: 'hero', content: {
        eyebrow: 'Why We Win',
        title: 'Built by the operator. Priced for the founder. Owned end-to-end.',
        subtitle: 'Three structural advantages that incumbents can\'t replicate without rebuilding their company.',
        titleSize: 50,
      }},
      { layout: 'split', content: {
        eyebrow: 'The Moat',
        title: 'Three structural reasons we win — and they compound.',
        body: 'We built around the operator\'s exact workflow because the founder lived it. We price for founders because we know their tool budget. And because we own the entire workflow — discovery, scoring, send, CRM — we capture closed-loop analytics that no point tool can.',
        bullets: [
          'Operator-built — every UI decision traces to real workflow pain',
          'Founder-priced — $39 entry vs. $300+ for incumbents',
          'End-to-end ownership — closed-loop analytics nobody else can produce',
        ],
      }},
      { layout: 'grid3', content: {
        eyebrow: 'Three moats',
        title: 'Each one is durable. Together they\'re a wedge.',
        cards: [
          { title: 'Operator origin', body: 'Founder ran creator partnerships before building this. The UI reflects real workflow — not analyst slideware.' },
          { title: 'Pricing position', body: '8–25x cheaper than incumbents at entry. Founder budgets clear easily. We grow into accounts the incumbents lose.' },
          { title: 'Workflow ownership', body: 'Because we own discovery → CRM, we capture metrics no point tool can. The data layer compounds every quarter.' },
        ],
      }},
      { layout: 'bigStat', content: {
        eyebrow: 'Competitive delta',
        stat: '8–25x',
        statSize: 280,
        statLabel: 'Cheaper than every B2B-capable incumbent at entry.',
        body: 'Modash starts at $300/mo. HypeAuditor at $400/mo. CreatorIQ at $10K+/yr. We start at $39/mo with the full workflow — including features none of them offer (AI fit score, native multi-platform send, closed-loop analytics).',
      }},
      { layout: 'quote', content: {
        quote: 'They\'re not just cheaper — they\'re built differently. The workflow assumes you\'re the one doing the work, which Modash and HubSpot don\'t.',
        quoteSize: 30,
        attribution: 'Beta user',
        attributionSub: 'On product-market fit signal',
      }},
      { layout: 'diagonal', content: {
        eyebrow: 'Why we win',
        title: 'Three structural advantages. Each one compounds.',
        body: 'Operator origin gives us product-market fit unique to this category. Founder pricing gives us distribution incumbents can\'t match without cannibalizing their enterprise contracts. End-to-end ownership gives us a data moat the longer we run.',
        callout: 'Origin.\nPrice.\nData.',
      }},
      { layout: 'bento', content: {
        eyebrow: 'Why we win',
        title: 'Three durable advantages.',
        cards: [
          { title: 'WHY WE WIN', headline: 'Operator origin. Founder pricing. End-to-end ownership.', body: 'Built by someone who lived the pain. Priced for the budgets incumbents ignore. Owns the full workflow, which means closed-loop analytics no competitor can replicate.' },
          { title: 'Origin', body: 'Founder-built. Real workflow fidelity.' },
          { title: 'Price', body: '$39 vs. $300+. 8–25x cheaper.' },
          { title: 'Data moat', body: 'Closed-loop analytics, by structure.' },
        ],
      }},
    ],
  },

  // ──────────────────────────────────────────────────────────────────
  // 15. THE TEAM
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'team',
    title: 'The Team',
    variations: [
      { layout: 'hero', content: {
        eyebrow: 'The Team',
        title: 'Two founders. Complementary roles. One product.',
        subtitle: 'Dylan builds. Ryan brings the industry. Together we cover product execution and the network needed to bring real B2B buyers in the door.',
        titleSize: 52,
      }},
      { layout: 'split', content: {
        eyebrow: 'Founders',
        title: 'Built by an operator. Distributed by an industry insider.',
        body: 'Dylan Meehan — founder, product, engineering, and customer-facing operations. Ran creator partnerships before building this, so the product reflects real workflow. Ryan Gaynor — co-originator, industry network, warm introductions, and ongoing strategic advisory. Together they cover product fidelity and B2B distribution from day one.',
        callout: 'Dylan\nbuilds.\nRyan\ndistributes.',
      }},
      { layout: 'grid3', content: {
        eyebrow: 'Roles',
        title: 'Three pillars. Two founders. Zero overlap.',
        cards: [
          { title: 'Product · Dylan', body: 'Product, engineering, customer-facing operations, marketing. Day-to-day ownership of build and customer outcomes.' },
          { title: 'Industry · Ryan', body: 'Co-originator of the concept. Network access, warm intros to ICP, ongoing industry advisory.' },
          { title: 'Strategy · Both', body: 'Shared 50/50 oversight on direction, finances, and material decisions. Operating roles run independently.' },
        ],
      }},
      { layout: 'bigStat', content: {
        eyebrow: 'Founders',
        stat: '2',
        statSize: 360,
        statLabel: 'Founders. Complementary skill sets. No role overlap.',
        body: 'One founder builds and serves customers. One founder originates concept, brings industry knowledge, and opens doors. Each role essential. Neither replaceable. Both essential to the product existing at all.',
      }},
      { layout: 'quote', content: {
        quote: 'Creator Outreach wouldn\'t exist without the combination of Ryan\'s industry origin and Dylan\'s product execution. Neither role is greater. Both are essential.',
        quoteSize: 28,
        attribution: 'Founders Agreement, Section 1',
        attributionSub: 'Gaynor Media LLC · May 2026',
      }},
      { layout: 'diagonal', content: {
        eyebrow: 'The team',
        title: 'Operator + insider. Build + distribute.',
        body: 'The two roles that matter most at this stage of a B2B SaaS — the person who can ship the product without compromise, and the person who can put it in front of the right buyers. We have both. We split the work cleanly. We made it durable in writing.',
        callout: 'Build +\ndistribute.\nNo gaps.',
      }},
      { layout: 'bento', content: {
        eyebrow: 'The team',
        title: 'Two founders. Two roles. One company.',
        cards: [
          { title: 'TEAM', headline: 'Operator-builder + industry insider.', body: 'Dylan owns product, engineering, and customers. Ryan owns industry network, warm intros, and entity. 55/45 revenue split. 50/50 decisions. Written, signed, durable.' },
          { title: 'Dylan Meehan', body: 'Product, engineering, customers, marketing.' },
          { title: 'Ryan Gaynor', body: 'Co-origin, network, intros, advisory.' },
          { title: 'Entity', body: 'Gaynor Media LLC · founders agreement signed.' },
        ],
      }},
    ],
  },

  // ──────────────────────────────────────────────────────────────────
  // 16. ROADMAP PREVIEW
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'roadmap',
    title: 'Roadmap preview',
    variations: [
      { layout: 'hero', content: {
        eyebrow: 'Roadmap',
        title: 'What we shipped. What\'s next. What\'s in twelve months.',
        subtitle: 'A roadmap built around customer pull — not around what looks impressive in a deck.',
        titleSize: 48,
      }},
      { layout: 'split', content: {
        eyebrow: 'Next 12 months',
        title: 'Three roadmap phases. All customer-driven.',
        body: 'Q3: deepen the AI scoring layer with custom criteria and ICP templates. Q4: build the team surface — shared CRM, role-based access, billing for orgs. Q1 2027: ship the analytics layer — full closed-loop reporting and benchmarks. Every milestone is locked to revenue, not vanity.',
        bullets: [
          'Q3 2026 — Custom ICP scoring, template library',
          'Q4 2026 — Team plans, shared CRM, org billing',
          'Q1 2027 — Full analytics layer, benchmarks',
          'Q2 2027 — Two more platforms (Twitch + Substack)',
        ],
      }},
      { layout: 'grid3', content: {
        eyebrow: 'Three milestones',
        title: 'Customer-pulled. Revenue-gated. Honestly sequenced.',
        cards: [
          { title: 'Q3 2026 · Scoring depth', body: 'Custom ICP templates, score component tuning, saved searches. Unlocked by Pro-tier customers reaching repeat-campaign maturity.' },
          { title: 'Q4 2026 · Team layer', body: 'Multi-seat plans, shared CRM views, role-based access, org-level billing. Unlocked by Scale-tier signal at ~$10K MRR.' },
          { title: 'Q1 2027 · Analytics', body: 'Cross-customer benchmarks, full closed-loop reporting, exportable insights. Unlocked once the data layer has 6+ months of signal.' },
        ],
      }},
      { layout: 'bigStat', content: {
        eyebrow: 'Roadmap discipline',
        stat: '$10K',
        statSize: 280,
        statLabel: 'MRR gate before we build the team layer.',
        body: 'We don\'t ship enterprise features before we have enterprise demand. Every milestone is locked to a revenue threshold so we avoid the build-for-no-one trap that kills most early-stage SaaS roadmaps.',
      }},
      { layout: 'quote', content: {
        quote: 'A roadmap is a hypothesis. Every line item we ship has to come from a customer who already paid us to wait for it.',
        quoteSize: 30,
        attribution: 'Dylan Meehan',
        attributionSub: 'On disciplined product sequencing',
      }},
      { layout: 'diagonal', content: {
        eyebrow: 'What\'s next',
        title: 'Customer-pulled. Revenue-gated. Honestly small.',
        body: 'We don\'t promise twelve features per quarter. We promise three milestones, each tied to a specific revenue threshold, each driven by customer pull rather than competitive copy-paste. Honest roadmaps compound.',
        callout: 'Three\nmilestones.\nNo fluff.',
      }},
      { layout: 'bento', content: {
        eyebrow: 'Roadmap',
        title: 'Three honest phases. All customer-driven.',
        cards: [
          { title: 'ROADMAP · 12 MONTHS', headline: 'Scoring depth → team layer → analytics.', body: 'Q3 2026 deepens AI scoring. Q4 2026 ships team plans. Q1 2027 unlocks the closed-loop analytics layer. Every milestone gated to revenue and customer pull.' },
          { title: 'Q3 · Scoring', body: 'Custom ICP, templates, saved searches.' },
          { title: 'Q4 · Team', body: 'Multi-seat, shared CRM, org billing.' },
          { title: 'Q1 · Analytics', body: 'Closed-loop reporting + benchmarks.' },
        ],
      }},
    ],
  },

  // ──────────────────────────────────────────────────────────────────
  // 17. GET STARTED CTA
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'cta',
    title: 'Get started',
    variations: [
      { layout: 'hero', content: {
        eyebrow: 'Get Started',
        title: 'Try it on a real campaign this week.',
        subtitle: 'Sign up at creatoroutreach.net. First 10 customers get $20/mo locked forever. No demo call required.',
        titleSize: 60,
      }},
      { layout: 'split', content: {
        eyebrow: 'Try it now',
        title: 'Sign up at creatoroutreach.net. Run a real campaign in 10 minutes.',
        body: 'No demo call. No "contact sales." No procurement cycle. Start a search, see the AI scores, send your first message — all within ten minutes of signing up. First 10 customers get $20/mo locked forever; everyone else starts at $39.',
        callout: 'creatoroutreach\n.net\n\nStart in\n10 minutes.',
      }},
      { layout: 'grid3', content: {
        eyebrow: 'Three ways to start',
        title: 'Whichever path fits how you buy.',
        cards: [
          { title: 'Self-serve', body: 'Sign up at creatoroutreach.net. Pro plan, $39/mo. First 10 customers get $20/mo locked. Cancel anytime.' },
          { title: 'Warm intro', body: 'Email dmeehanj@gmail.com. We\'ll send a personal walkthrough and confirm fit before any commitment.' },
          { title: 'Investor brief', body: 'For partners interested in the round, reach out directly. We\'ll share deep-dive metrics, financials, and pipeline.' },
        ],
      }},
      { layout: 'bigStat', content: {
        eyebrow: 'CTA',
        stat: '10 min',
        statSize: 280,
        statLabel: 'From signup to first sent message.',
        body: 'Try a real outreach campaign tonight. Visit creatoroutreach.net, sign up, run a search, send a real message — and see the workflow yourself before any sales conversation.',
      }},
      { layout: 'quote', content: {
        quote: 'The fastest way to evaluate this product is to use it on a real campaign for ten minutes. We built it for that test.',
        quoteSize: 32,
        attribution: 'Dylan Meehan',
        attributionSub: 'Founder · dmeehanj@gmail.com',
      }},
      { layout: 'diagonal', content: {
        eyebrow: 'Get started',
        title: 'creatoroutreach.net — sign up, search, send.',
        body: 'Self-serve onboarding. No demo call required. First 10 customers lock in $20/month forever. Cancel anytime. For warm intros, deep-dives, or investor conversations: dmeehanj@gmail.com.',
        callout: 'creator\noutreach\n.net',
      }},
      { layout: 'bento', content: {
        eyebrow: 'Get started',
        title: 'Three ways to engage. One workflow.',
        cards: [
          { title: 'GET STARTED', headline: 'Sign up in 10 minutes. Cancel anytime.', body: 'creatoroutreach.net — self-serve onboarding, $39 Pro plan, $20/mo locked for first 10 customers. For walkthroughs or investor conversations, email dmeehanj@gmail.com.' },
          { title: 'Self-serve', body: 'creatoroutreach.net · $39/mo · cancel anytime.' },
          { title: 'Walkthrough', body: 'dmeehanj@gmail.com · personal demo.' },
          { title: 'Invest', body: 'Reach out direct. Deep-dive on request.' },
        ],
      }},
    ],
  },

  // ──────────────────────────────────────────────────────────────────
  // 18. TRUST & COMPLIANCE APPENDIX
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'compliance',
    title: 'Trust & compliance',
    variations: [
      { layout: 'hero', content: {
        eyebrow: 'Trust & Compliance',
        title: 'Built for B2B from day one — including the legal layer.',
        subtitle: 'GDPR, CCPA, all 11 US state privacy laws, Illinois PIPA, signed DPAs with every sub-processor, and a 30+ page comprehensive manual.',
        titleSize: 42,
      }},
      { layout: 'split', content: {
        eyebrow: 'Compliance posture',
        title: 'Legal infrastructure that closes B2B deals — not the bare minimum.',
        body: 'Most early-stage SaaS treats compliance as a Series A problem. We treated it as a v1.0 problem because B2B buyers ask before they sign. The result: every DPA needed for procurement is already on the public website, every privacy law is already covered in the Privacy Policy, and the comprehensive manual is downloadable as a single PDF for legal review.',
        bullets: [
          'GDPR, CCPA, VCDPA, CPA, CTDPA, UCPA, TDPSA, OCPA, IPDPA, TIPA, DPDPA, NHPDPA — all covered',
          'Illinois PIPA breach notification language included',
          'DPAs counter-signed with Unipile, Anthropic, Stripe, Vercel',
          '30+ page comprehensive policy manual, downloadable as PDF or Word',
        ],
      }},
      { layout: 'grid3', content: {
        eyebrow: 'Three trust pillars',
        title: 'Privacy. Sub-processors. Data governance.',
        cards: [
          { title: 'Privacy law', body: 'GDPR, CCPA, and 11 US state privacy laws covered explicitly in the Privacy Policy. Universal opt-out signals honored.' },
          { title: 'Sub-processors', body: 'DPAs counter-signed with Unipile, Anthropic, Stripe, and Vercel. Posted publicly on /admin/legal for procurement.' },
          { title: 'Internal governance', body: '8-document comprehensive policy manual — InfoSec, Acceptable Use, Incident Response, BCP, Data Retention, Access Control, and more.' },
        ],
      }},
      { layout: 'bigStat', content: {
        eyebrow: 'Legal infrastructure',
        stat: '8 / 4 / 11',
        statSize: 200,
        statLabel: 'Internal policies. Signed DPAs. US state privacy laws.',
        body: 'Eight internal policies. Four counter-signed sub-processor DPAs. Eleven US state privacy laws explicitly covered, plus GDPR and UK GDPR. The compliance posture of a Series B company at v1.0.',
      }},
      { layout: 'quote', content: {
        quote: 'They had every DPA already signed and posted. We didn\'t have to wait two weeks for procurement to chase paperwork. That moved them from \'maybe\' to \'closed\' in one meeting.',
        quoteSize: 28,
        attribution: 'Hypothetical B2B procurement reviewer',
        attributionSub: 'On compliance as a closing accelerant',
      }},
      { layout: 'diagonal', content: {
        eyebrow: 'Trust posture',
        title: 'Compliance built before the first enterprise deal — not after.',
        body: 'Every B2B sale eventually touches procurement. The teams that get there fastest already have DPAs signed, privacy laws covered, and policies documented. We treated that as v1.0 infrastructure, not a Series A problem.',
        callout: 'Built\nfor B2B.\nFrom\nday one.',
      }},
      { layout: 'bento', content: {
        eyebrow: 'Trust & compliance',
        title: 'The compliance infrastructure most B2B SaaS waits years to build.',
        cards: [
          { title: 'TRUST POSTURE', headline: 'Built like a Series B. At v1.0.', body: 'Privacy laws covered. DPAs signed. Internal policies documented. Everything downloadable as PDF or Word for legal review. Procurement deals close faster because the paperwork is ready.' },
          { title: 'Privacy law', body: 'GDPR, CCPA, 11 US state laws.' },
          { title: 'DPAs signed', body: 'Unipile, Anthropic, Stripe, Vercel.' },
          { title: 'Policies', body: '8 internal policies. PDF + Word.' },
        ],
      }},
    ],
  },
]

module.exports = { TOPICS }
