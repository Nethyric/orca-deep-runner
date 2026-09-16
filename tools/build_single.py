#!/usr/bin/env python3
"""Build Orca: Deep Runner — inline CSS, concatenate JS, write dist/orca-deep-runner.html."""
import re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
(DIST := ROOT / "dist").mkdir(exist_ok=True)
OUT = DIST / "orca-deep-runner.html"

JS_ORD = [
    "js/engine/physics.js", "js/engine/pool.js", "js/engine/input.js",
    "js/entities/orca.js", "js/entities/prey.js", "js/entities/predator.js",
    "js/systems/particles.js", "js/systems/audio.js", "js/systems/save.js",
    "js/systems/levels.js", "js/systems/hud.js", "js/main.js",
]

def inline_css(html):
    def repl(m):
        f = ROOT / m.group(1)
        return f"<style>\n{f.read_text(encoding='utf-8')}\n</style>" if f.exists() else m.group(0)
    return re.sub(r'<link\s+rel="stylesheet"\s+href="([^"]+)"\s*/?>', repl, html)

def clean_js(src):
    out = []
    skipping_list = False
    for l in src.splitlines():
        s = l.lstrip()
        if re.match(r"import\s+.*?\s+from\s+['\"]\.\.?/", l): continue
        if   re.match(r"export\s+default\s+class\b", l): out.append("class"   + l[len("export default class"):])
        elif re.match(r"export\s+class\b", l):          out.append("class"   + l[len("export class"):])
        elif re.match(r"export\s+const\b", l):           out.append("const"   + l[len("export const"):])
        elif re.match(r"export\s+let\b", l):             out.append("let"     + l[len("export let"):])
        elif re.match(r"export\s+function\b", l):        out.append("function"+ l[len("export function"):])
        elif re.match(r"export\s+default\s+null\s*;?\s*$", l): pass          # meaningless in a bundle
        elif re.match(r"export\s+default\s+", l):  out.append(l[len("export default"):].lstrip())
        elif re.match(r"export\s*\{", l):
            # multi-line export list: skip until the closing '}'
            if not re.search(r"\}\s*;?\s*$", l):
                skipping_list = True
        elif skipping_list:
            if re.search(r"\}\s*;?\s*$", l): skipping_list = False
        else: out.append(l)
    return "\n".join(out)

def build():
    html = inline_css((ROOT / "index.html").read_text(encoding="utf-8"))
    bundle = "\n\n".join(f"// ─ {p} ─\n{clean_js((ROOT/p).read_text(encoding='utf-8'))}" for p in JS_ORD)
    # Remove ALL script tags with src (both module and non-module)
    html = re.sub(r'<script\s+[^>]*src="[^"]+"[^>]*></script>', '', html)
    # Insert the inline bundle right before </body>
    inline = f'<script type="module">\n{bundle}\n</script>'
    assert "</body>" in html, "index.html has no </body>"
    html = html.replace("</body>", inline + "\n</body>", 1)
    OUT.write_text(html, encoding="utf-8")
    print(f"Written: {OUT}")
    # honest verification: the bundle must actually be inside the output
    out = OUT.read_text(encoding="utf-8")
    problems = []
    if "class Orca" not in out: problems.append("bundle missing Orca class")
    if "requestAnimationFrame" not in out: problems.append("bundle missing game loop")
    if len(out) < 50000: problems.append(f"output suspiciously small ({len(out)} bytes)")
    bad = re.findall(r'(?:href|src)="(?!#|data:|blob:)[^"]*(?:\.css|\.js)"', out)
    if bad: problems.append(f"local refs remain: {bad}")
    if problems:
        for p_ in problems: print(f"ERROR: {p_}", file=sys.stderr)
        sys.exit(1)
    print(f"All checks passed ({len(out)} bytes, bundle verified inside).")

if __name__ == "__main__": build()