# Grand Canyon Migration Discrepancy Report

**Generated**: 2026-02-19T14:31:07.717Z

---

## Summary

| Metric | Count |
|--------|-------|
| Duplicate Timesheet Groups | 360 |
| Total Duplicate Timesheet Records | 728 |
| Duplicate Expense Groups | 18 |
| Total Duplicate Expense Records | 36 |
| Orphan Timesheet Entries | 0 |
| Orphan Expense Entries | 0 |
| Encoding Issues | 0 |
| Unmapped Users | 0 |

---

## Count Discrepancies

| Table | Legacy | New | Difference | Reason |
|-------|--------|-----|------------|--------|
| timesheets | 21726 | 21257 | +469 | Duplicate (user_id, week_start) combinations merged into single records |
| timesheet_entries | 22681 | 23431 | -750 | Entries from duplicate timesheets merged; some had missing projects |
| expenses | 4593 | 4575 | +18 | Duplicate (user_id, week_start) combinations merged |
| expense_entries | 3153 | 3141 | +12 | Some entries reference non-existent expense types or projects |

---

## Duplicate Timesheets

These timesheet records have the same (user, week_start) combination in the legacy system.
**Action taken**: Merged into single timesheet, entries preserved.

| User Email | Week Start | Count | Legacy IDs |
|------------|------------|-------|------------|
| berardinodominique@gmail.com | 2012-09-03 | 2 | 20, 21 |
| grandcanyon@hotmail.ca | 2012-09-24 | 3 | 145, 156, 157 |
| dperrault@ssti.ca | 2014-09-01 | 2 | 2503, 2504 |
| placeholder@mail.ca | 2015-08-10 | 2 | 3762, 3774 |
| placeholder@mail.ca | 2015-08-17 | 2 | 3800, 3808 |
| grandcanyon@hotmail.ca | 2015-09-14 | 2 | 3916, 3917 |
| placeholder@mail.ca | 2016-05-02 | 2 | 4686, 4689 |
| placeholder@mail.ca | 2016-06-20 | 2 | 4879, 5247 |
| placeholder@mail.ca | 2016-06-27 | 2 | 4917, 4921 |
| belle-vivie@live.fr | 2016-06-27 | 2 | 4918, 4919 |
| placeholder@mail.ca | 2016-07-04 | 2 | 4935, 4943 |
| belle-vivie@live.fr | 2016-07-04 | 2 | 4941, 4947 |
| placeholder@mail.ca | 2016-07-11 | 2 | 4970, 5246 |
| placeholder@mail.ca | 2016-08-01 | 2 | 5015, 5243 |
| placeholder@mail.ca | 2016-07-25 | 2 | 5018, 5244 |
| placeholder@mail.ca | 2016-07-18 | 2 | 5019, 5245 |
| placeholder@mail.ca | 2016-08-08 | 2 | 5046, 5242 |
| placeholder@mail.ca | 2016-08-15 | 2 | 5080, 5241 |
| placeholder@mail.ca | 2016-08-22 | 2 | 5117, 5240 |
| placeholder@mail.ca | 2016-08-29 | 2 | 5149, 5239 |
| placeholder@mail.ca | 2016-09-05 | 2 | 5179, 5238 |
| placeholder@mail.ca | 2016-09-12 | 2 | 5222, 5237 |
| grandcanyon@hotmail.ca | 2016-09-12 | 2 | 5223, 5231 |
| placeholder@mail.ca | 2016-09-19 | 2 | 5256, 5258 |
| placeholder@mail.ca | 2016-09-26 | 2 | 5296, 5305 |
| placeholder@mail.ca | 2016-10-03 | 2 | 5324, 5415 |
| placeholder@mail.ca | 2016-10-10 | 2 | 5368, 5414 |
| placeholder@mail.ca | 2016-10-17 | 2 | 5392, 5413 |
| sylvainpoirier27@icloud.com | 2016-10-17 | 2 | 5429, 5437 |
| grandcanyon@hotmail.ca | 2016-10-24 | 2 | 5433, 5436 |
| grandcanyon@hotmail.ca | 2016-10-17 | 2 | 5434, 5435 |
| sylvainpoirier27@icloud.com | 2016-10-24 | 2 | 5448, 5449 |
| sylvainpoirier27@icloud.com | 2016-10-31 | 2 | 5487, 5488 |
| grandcanyon@hotmail.ca | 2016-10-31 | 2 | 5491, 5494 |
| sylvainpoirier27@icloud.com | 2016-11-07 | 2 | 5546, 5573 |
| grandcanyon@hotmail.ca | 2016-11-07 | 2 | 5562, 5569 |
| grandcanyon@hotmail.ca | 2016-11-28 | 2 | 5661, 5701 |
| sylvainpoirier27@icloud.com | 2016-12-05 | 2 | 5667, 5696 |
| placeholder@mail.ca | 2017-01-09 | 2 | 5839, 5846 |
| placeholder@mail.ca | 2017-01-16 | 2 | 5884, 5894 |
| placeholder@mail.ca | 2017-01-23 | 2 | 5913, 5923 |
| placeholder@mail.ca | 2017-01-30 | 2 | 5937, 5948 |
| sylvainpoirier27@icloud.com | 2017-01-30 | 2 | 5943, 5958 |
| sylvainpoirier27@icloud.com | 2017-02-06 | 2 | 5974, 5981 |
| placeholder@mail.ca | 2017-02-06 | 2 | 5984, 5997 |
| sylvainpoirier27@icloud.com | 2017-02-13 | 2 | 6008, 6011 |
| placeholder@mail.ca | 2017-02-13 | 2 | 6031, 6040 |
| placeholder@mail.ca | 2017-02-20 | 2 | 6041, 6066 |
| sylvainpoirier27@icloud.com | 2017-02-20 | 2 | 6048, 6063 |
| sylvainpoirier27@icloud.com | 2017-02-27 | 2 | 6080, 6101 |

*...and 310 more*

---

## Duplicate Expenses

Same (user, week_start) combination in the legacy system.

| User Email | Week Start | Count | Legacy IDs |
|------------|------------|-------|------------|
| dperrault@ssti.ca | 2014-10-20 | 2 | 155, 159 |
| sylvainpoirier27@icloud.com | 2017-02-06 | 2 | 870, 878 |
| placeholder@mail.ca | 2017-02-06 | 2 | 875, 922 |
| sylvainpoirier27@icloud.com | 2017-02-27 | 2 | 912, 920 |
| grandcanyon@hotmail.ca | 2017-04-10 | 2 | 1004, 1005 |
| grandcanyon@hotmail.ca | 2017-07-10 | 2 | 1170, 1178 |
| sylvainpoirier27@icloud.com | 2018-03-19 | 2 | 1618, 1637 |
| grandcanyon@hotmail.ca | 2018-11-12 | 2 | 1938, 1939 |
| grandcanyon@hotmail.ca | 2018-11-19 | 2 | 1947, 1956 |
| grandcanyon@hotmail.ca | 2018-11-05 | 2 | 1958, 1960 |
| grandcanyon@hotmail.ca | 2018-10-29 | 2 | 1959, 1961 |
| dannypoissant8@gmail.com | 2023-10-09 | 2 | 3888, 3889 |
| dannypoissant8@gmail.com | 2023-10-16 | 2 | 3895, 3896 |
| dannypoissant8@gmail.com | 2023-10-23 | 2 | 3902, 3903 |
| dannypoissant8@gmail.com | 2023-10-30 | 2 | 3910, 3911 |
| dannypoissant8@gmail.com | 2023-11-06 | 2 | 3915, 3916 |
| dannypoissant8@gmail.com | 2024-06-03 | 2 | 4083, 4086 |
| dannypoissant8@gmail.com | 2024-06-10 | 2 | 4093, 4096 |

---

## Orphan Timesheet Entries

These entries reference projects that don't exist in the transformed data.

| TSD ID | TS ID | Missing Project ID | Hours | Notes |
|--------|-------|-------------------|-------|-------|

---

## Encoding Issues (Sample)

French characters not properly encoded.

| Table | ID | Field | Current Value |
|-------|-----|-------|---------------|

---

## Unmapped Users

Users from legacy system that couldn't be mapped to profiles.

| Legacy ID | Email | Name |
|-----------|-------|------|

---

## Full Details

See `MIGRATION_DISCREPANCY_REPORT.json` for complete data including all records.

---

*Report generated by: generate-discrepancy-report.js*
