# DPA reminder — Resend

> Paste-and-send to **legal@resend.com** (or whichever contact Resend
> uses for DPA execution — check their footer / support page first).
> Cc yourself for the audit trail.

---

**Subject:** Data Processing Agreement — Gaynor Media LLC / Creator Outreach

**To:** legal@resend.com

Hi Resend team,

I'm following up on a Data Processing Agreement for our use of Resend
as a sub-processor.

**Our details:**
- Controller: **Gaynor Media LLC** (Illinois, USA), operating
  **Creator Outreach** (creatoroutreach.net) — a B2B SaaS for creator
  outreach.
- Resend account email: **dmeehanj@gmail.com**
- Scope of use: transactional email delivery for in-product
  notifications (signups, admin alerts, password resets). No
  marketing campaigns, no large-volume sending.
- Personal data processed by Resend on our behalf: email addresses
  of our authenticated users, plus message content of those
  notifications.
- We are subject to GDPR (EU user base) and several US state privacy
  laws (CCPA/CPRA, VCDPA, CPA, CTDPA, UCPA, TDPSA, OCPA, IPDPA, TIPA,
  DPDPA, NHPDPA), so an Article 28 DPA is required.

**What we need:**

Either of the following would close this out for us:

1. A counter-signed DPA we can file (PDF), OR
2. Confirmation that your current published DPA at
   https://resend.com/legal/dpa (or wherever it's posted) is
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
| They send a counter-signed PDF | Save to `public/legal/DPA-Resend-signed.pdf` + add row to `app/admin/legal/page.tsx` + add row to `app/subprocessors/page.tsx` PUBLIC_DPAS array |
| They point to a published DPA URL | Note the URL + acceptance clause; add a `externalUrl`-style row to admin/legal (the data model already supports this — see Anthropic/Stripe entries) |
| They ask for revenue thresholds | We're pre-revenue; tell them so. Most vendors don't gate DPAs by revenue but some do for enterprise tiers. |
| Radio silence after 7 days | Send a one-line bump: "Hi — circling back on the DPA request from $DATE. Anything you need from me?" |

## Template tweaks before sending

- Confirm `dmeehanj@gmail.com` is the actual account email on Resend
- Confirm the physical address you put in your CAN-SPAM footer (it
  should match what's on file at Stripe + the address you'd sign a
  DPA at). Look it up in your profile settings if unsure.
- If you've already corresponded with Resend support about anything
  else, reply on that thread instead of starting fresh.
