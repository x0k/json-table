---
"web": patch
---

Add an implementation picker to the options form: tables can now be built with the legacy 0.3.0 block pipeline (`@json-table/core/legacy`) instead of the current tree pipeline. Legacy supports HTML and ASCII output with the default/manual presets mapped to its flags; XLSX output and mirror/transpose transforms stay available for the current implementation only.
