#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TMP_JS="$(mktemp)"
trap 'rm -f "$TMP_JS"' EXIT

: > "$TMP_JS"
while IFS= read -r src; do
  printf "\n// ---- %s ----\n" "$src" >> "$TMP_JS"
  cat "$src" >> "$TMP_JS"
  printf "\n" >> "$TMP_JS"
done < <(rg -o 'src="\./[^"]+"' index.html | sed -E 's/src="\.\/(.*)"/\1/')

awk -v js_file="$TMP_JS" '
  BEGIN {
    while ((getline line < "styles.css") > 0) css = css line "\n";
    while ((getline line < js_file) > 0) js = js line "\n";
  }
  /<link rel="stylesheet" href="\.\/styles\.css">/ {
    print "  <style>";
    printf "%s", css;
    print "  </style>";
    next;
  }
  /<script src="\.\/[^"]+" defer><\/script>/ { next; }
  /<\/body>/ {
    print "  <script>";
    printf "%s", js;
    print "  </script>";
    print;
    next;
  }
  { print; }
' index.html > bundle.html

echo "Built bundle.html"
