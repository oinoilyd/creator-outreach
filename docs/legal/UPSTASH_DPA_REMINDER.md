# DPA reminder — Upstash

> Paste-and-send to **support@upstash.com** (or their privacy/legal
> contact — check upstash.com/legal first). Cc yourself for the
> audit trail.

---

**Subject:** Data Processing Agreement — Gaynor Media LLC / Creator Outreach

**To:** support@upstash.com

Hi Upstash team,

I'm following up on a Data Processing Agreement for our use of
Upstash (Redis + QStash) as a sub-processor.

**Our details:**
- Controller: **Gaynor Media LLC** (Illinois, USA), operating
  **Creator Outreach** (creatoroutreach.net) — a B2B SaaS for
  creator outreach.
- Upstash account email: **dmeehanj@gmail.com**
- Scope of use:
  - **Redis** — ephemeral caching of search results and rate-limit
    counters. No persistent user data is stored.
  - **QStash** — scheduled job dispatch for follow-up emails and
    cron tasks (e.g. nightly subscription reconciliation).
- Personal data processed: only transient identifiers (user IDs,
  email tracking IDs) held for cache TTLs (minutes to hours). No
  direct PII storage.
- We are subject to GDPR (EU user base) and several US state privacy
  laws (CCPA/CPRA, VCDPA, CPA, CTDPA, UCPA, TDPSA, OCPA, IPDPA, TIPA,
  DPDPA, NHPDPA), so an Article 28 DPA is required.

**What we need:**

Either of the following would close this out for us:

1. A counter-signed DPA we can file (PDF), OR
2. Confirmation that your current published DPA at
   https://upstash.com/legal/dpa (or wherever it's posted) is
   automatically incorporated into our subscription — with a
   pointer to the clause that says so, so we can cite it in our
   public sub-processor disclosure.

**Signer on our side:**
Dylan Meehan, Founder, Gaynor Media LLC
Address: [insert your physical address — same one used in CAN-SPAM
footer + Stripe account]
Email: dmeehanj@gmail.com

Happy to use PandaDoc, DocuSign, or whatever signing flow you
prefer. Our public sub-processor list at
https://creatoroutreach.net/subprocessors links to all of our other
counter-signed DPAs (Stripe, Vercel, Supabase, Anthropic, Unipile)
once they're in place.

Thanks for the quick turnaround — happy to provide anything else
you need.

Best,
Dylan Meehan
Founder, Creator Outreach
Gaynor Media LLC
dmeehanj@gmail.com

---

## What to do once they reply

| Their response | Your action |
|---|---|
| They send a counter-signed PDF | Save to `public/legal/DPA-Upstash-signed.pdf` + add row to `app/admin/legal/page.tsx` + add row to `app/subprocessors/page.tsx` PUBLIC_DPAS array |
| They point to a published DPA URL | Note the URL + acceptance clause; add a `externalUrl` row to admin/legal (the data model already supports this — see Anthropic/Stripe entries) |
| They ask which Upstash products | Tell them: **Redis (Global)** + **QStash** are both active. No Vector / no Kafka. |
| Radio silence after 7 days | Send a one-line bump: "Hi — circling back on the DPA request from $DATE. Anything you need from me?" |

## Template tweaks before sending

- Confirm `dmeehanj@gmail.com` is the actual account email on
  Upstash (Upstash uses GitHub/Google SSO — the email may be
  whatever account you signed up with)
- Confirm your physical address matches what's in your CAN-SPAM
  footer + Stripe account
- If your usage of Upstash has changed (e.g. you're no longer using
  QStash), update the "Scope of use" paragraph before sending — the
  data inventory drives the DPA's coverage scope.

## Note on Upstash's privacy posture

Upstash publishes a DPA at https://upstash.com/legal/dpa that they
treat as automatically incorporated into the standard subscription
agreement. If they reply with just that link, that's likely
sufficient for our compliance posture — but document the
acceptance email so the audit trail is complete.
