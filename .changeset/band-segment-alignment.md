---
"@json-table/core": patch
---

Fix lifted band segment alignment: decapitated bodies narrower than their band segment (e.g. a bare filler where the band spans an indexed table) now span to the band width instead of leaving a trailing pad that shifted every later segment under the wrong header.
