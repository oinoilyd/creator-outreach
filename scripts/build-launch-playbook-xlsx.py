#!/usr/bin/env python3
"""
Build the launch playbook as an .xlsx file — JUST the action table.

Output: docs/launch-playbook.xlsx — single table, color-coded by
owner, status dropdown. Nothing else.

Re-run any time the playbook content changes:
    python3 scripts/build-launch-playbook-xlsx.py
"""
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation

OUTPUT_PATH = "docs/launch-playbook.xlsx"

# ── Row schema ──────────────────────────────────────────────────────
# (number, owner, action, why_it_matters, time_estimate)
ROWS = [
    # Dylan's actions
    (1, "Dylan", "Build product demo video (3-5 min)",
     "Walk through AI fit score, 5-platform search, outreach send, CRM, custom analytics. Practical, not narrative. Ryan links this in warm intros so leads can see the product.",
     "2-4 hrs"),
    (2, "Dylan", "Write Ryan's warm-intro email template",
     "First impression for all 100 leads. Casual + credible + clear ask.",
     "15 min"),
    (3, "Dylan", "Write follow-up email sequence (first reply + 2-3 follow-ups)",
     "Conversion determinant. Most leads need 2-3 touches before they bite.",
     "30 min"),
    (4, "Dylan", "Set up early-customer discount in Stripe",
     "First 10 customers get $20/mo locked forever OR 2 months free. Urgency + reward for early adopters. Stripe coupons handle it.",
     "15 min"),
    (5, "Dylan", "Walk through onboarding as a new user",
     "Incognito → signup → first search → first outreach. Fix anything janky. First 5 minutes determines 5/10 vs 8/10 conversion.",
     "30 min"),
    (6, "Dylan", "Polish /pricing page FAQ",
     "Anticipate top 5 objections + answer inline. Where leads decide yes/no.",
     "30 min"),
    (7, "Dylan", "Plan testimonial collection",
     "What's the moment you ask each customer for a quote? First 5 testimonials = next 100 customers.",
     "15 min"),

    # Ryan's actions
    (8, "Ryan", "Reply with Gaynor Media LLC info",
     "State, county, full registered address, EIN. Unblocks Stripe legal-name fields + legal-doc placeholders.",
     "1 min"),
    (9, "Ryan", "Review employment contract for non-compete / non-solicit",
     "Flag any clauses that restrict working on a side venture. Identify accounts in the 100-lead pipeline that are 'off-limits' (current employer's customers).",
     "20 min"),
    (10, "Ryan", "Curate the 100 leads",
     "Segment into 'safe to intro' vs 'skip' based on contract review (#9). Build the actual list with email + context per lead.",
     "30-60 min"),
    (11, "Ryan", "Produce founder story video (2-4 min)",
     "Ryan tells his story — industry experience, why this product, what it means to him — ending with the product as the resolution. Sells the WHY; product demo (#1) sells the WHAT. Both linked in the warm intro.",
     "1-2 days (Ryan's editing time)"),
    (12, "Ryan", "Send the warm intros",
     "Use the intro template (#2) to the curated leads (#10), batch by batch so Dylan can keep up with inbound. This is where the 5-10 first customers come from.",
     "1-2 hrs across launch week"),

    # Joint actions
    (13, "Joint", "Dylan follows up + closes",
     "Reply to interested leads, book calls if needed, send checkout link, handle questions.",
     "Async, ongoing during launch"),
    (14, "Joint", "Daily 5-min sync during launch week",
     "What's converting, what's not, what to tweak. Async OK. Most learnings happen in the first 10 leads.",
     "5 min/day for ~2 weeks"),
]

# ── Build the workbook ─────────────────────────────────────────────
wb = Workbook()
ws = wb.active
ws.title = "Launch Playbook"

# Column headers
HEADERS = ["#", "Owner", "Action", "Why It Matters", "Time", "Status", "Notes"]
ws.append(HEADERS)

# Header styling — dark grey with white text
header_font = Font(bold=True, color="FFFFFF", size=11)
header_fill = PatternFill(start_color="1F2937", end_color="1F2937", fill_type="solid")
header_alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
for col_idx in range(1, len(HEADERS) + 1):
    cell = ws.cell(row=1, column=col_idx)
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = header_alignment

# Owner color coding
OWNER_FILLS = {
    "Dylan": PatternFill(start_color="DBEAFE", end_color="DBEAFE", fill_type="solid"),  # light blue
    "Ryan":  PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid"),  # light yellow
    "Joint": PatternFill(start_color="D1FAE5", end_color="D1FAE5", fill_type="solid"),  # light green
}

# Data row styling
data_alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)
thin_border = Border(
    left=Side(style='thin', color='E5E7EB'),
    right=Side(style='thin', color='E5E7EB'),
    top=Side(style='thin', color='E5E7EB'),
    bottom=Side(style='thin', color='E5E7EB'),
)

for num, owner, action, why, time_est in ROWS:
    ws.append([num, owner, action, why, time_est, "Pending", ""])
    row_idx = ws.max_row
    for col_idx in range(1, len(HEADERS) + 1):
        c = ws.cell(row=row_idx, column=col_idx)
        c.alignment = data_alignment
        c.border = thin_border
    owner_fill = OWNER_FILLS[owner]
    ws.cell(row=row_idx, column=1).fill = owner_fill
    ws.cell(row=row_idx, column=2).fill = owner_fill
    ws.cell(row=row_idx, column=3).font = Font(bold=True)

# Column widths
COLUMN_WIDTHS = {
    "A": 5,    # #
    "B": 10,   # Owner
    "C": 45,   # Action
    "D": 65,   # Why It Matters
    "E": 22,   # Time
    "F": 14,   # Status
    "G": 30,   # Notes
}
for col_letter, width in COLUMN_WIDTHS.items():
    ws.column_dimensions[col_letter].width = width

# Row heights
for row_idx in range(2, ws.max_row + 1):
    ws.row_dimensions[row_idx].height = 60
ws.row_dimensions[1].height = 30

# Status dropdown
dv = DataValidation(
    type="list",
    formula1='"Pending,In Progress,Done,Blocked"',
    allow_blank=True,
)
dv.add(f"F2:F{ws.max_row}")
ws.add_data_validation(dv)

# ── Save ───────────────────────────────────────────────────────────
wb.save(OUTPUT_PATH)
print(f"✓ Wrote {OUTPUT_PATH} ({ws.max_row} rows × {len(HEADERS)} columns)")
