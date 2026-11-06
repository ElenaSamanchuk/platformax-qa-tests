# Admin product visibility: offline evidence contract

`check_admin_visibility.py` compares a saved web `is_admin_visible` boolean with the saved native switch labelled `Видно только админам` (`field-is_admin_visible`). It requires the exact expected product ID/name, a visible matching product header, and one enabled visible switch whose value is strictly `"0"` or `"1"`.

The checker has no network, device, authentication, AI calls, or application writes. Input snapshots remain private. Only a compact result containing expected fixture identity, booleans and input SHA256 is printed. Do not commit real snapshots, session state or user details.

```sh
python3 scripts/check_admin_visibility.py --self-check
python3 -m py_compile scripts/check_admin_visibility.py

# Replace these placeholders with private approved fixture paths and identity.
python3 scripts/check_admin_visibility.py \
  --web '<PRIVATE_WEB_JSON>' \
  --case '<PRODUCT_ID>' '<EXACT_PRODUCT_NAME>' '<PRIVATE_NATIVE_AX_JSON>' \
  --out '<NEW_PRIVATE_RESULT_JSON>'
```

Repeat `--case` for independent products. `--out` refuses to overwrite an existing file; omit it to print the result only.

Exit codes: **0 PASS** (all values agree), **1 FAIL** (M-1012-STATE mismatch), **2 BLOCKED** (missing/invalid evidence, wrong fixture, ambiguous/hidden/disabled switch, non-boolean web value or non-binary native value). Missing data is never accepted as PASS. `--self-check` runs eight synthetic match/mismatch/guard controls without reading private evidence.

Supported web shapes are `props.paginator.data` from an Inertia response or `data.paginator.data` from a sanitized snapshot. Each record must contain integer `id`, exact `name` and boolean `is_admin_visible`. A safe extraction from individual product editor responses may use the sanitized shape; preserve its provenance and collection time separately. The canonical editor field is `product.is_admin_visible`; do not substitute a derived list alias for it.

Native input is a single WDA JSON tree. A visible node with the exact expected name and Header trait links the native screen to the supplied web product identity; native AX does not expose the product ID itself. The switch must have the expected label and identifier, explicit visibility/enabled flags and a binary string value.

This is an offline comparison of supplied evidence, not a live application regression. It cannot establish freshness, role/environment, server persistence, saving, or absence of intervening changes. Collect fresh live evidence with verified authorization, test environment and own QA fixtures before running it. A PASS on old evidence does not close a defect in a new build. No private fixture IDs, actual names, source dumps or authentication data are included here.
