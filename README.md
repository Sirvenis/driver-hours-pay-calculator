# WageCheck AU — Shift & Pay Calculator

An installable mobile Progressive Web App for Australian hourly/shift workers to track shifts and estimate gross pay.

Current free version:

- Start time and finish time
- Unpaid break minutes
- Hourly pay rate
- Overnight shift support
- Saved shift entries on the phone
- Weekly and fortnightly gross pay summaries
- 14-day shift history viewable all at once
- Offline support after first load

Paid-version prototype now added locally:

- Weekly and fortnightly Australian PAYG withholding estimates
- Tax-free threshold toggle
- Net pay estimate, calculated as gross pay minus PAYG withholding
- Multiple detailed break start/finish times for employer-ready records, with each break marked paid or unpaid
- Tested JSON lookup data converted from the ATO weekly and fortnightly tables

Remaining paid upgrade ideas:

- Longer/unlimited history
- Multiple jobs/employers
- Export to CSV/PDF
- Payslip comparison
- Overtime/penalty/allowance rules

Tax table source files kept outside the app for now:

- `/home/andrew/Documents/Australian Tax Tables/n1005 [DE-65156] - Weekly tax table_DIGITAL.pdf`
- `/home/andrew/Documents/Australian Tax Tables/n1006 [DE-63731] - Fortnightly tax table_DIGITAL.pdf`

The free app intentionally labels base shift totals as gross pay estimates. The paid-version prototype adds PAYG/net pay estimates from tested JSON lookup tables converted from the ATO PDFs. Keep the source PDFs outside the static app; publish only the checked JSON tables used by the app.

## Install on Phone

Open the GitHub Pages URL on your phone.

### iPhone
1. Open in Safari
2. Tap Share
3. Tap Add to Home Screen
4. Tap Add

### Android
1. Open in Chrome
2. Tap the menu
3. Tap Install app or Add to Home screen
