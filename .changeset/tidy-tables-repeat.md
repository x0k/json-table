---
"@json-table/core": patch
---

Stop stretching the last data row over missing rows/columns. Side-by-side record columns and array rows are now equalized band/body separately: scalar-only blocks span (they read as "applies to all rows/columns"), data blocks scale by a uniform multiplier while the proportional resize guard allows it, and anything left over becomes an explicit empty cell instead of a misleading rowspan/colspan.
