"""Incremental offline translations of public menu text. Never edits menu.json."""
from __future__ import annotations
import argparse
import datetime
import json
from pathlib import Path

TARGETS = ("en", "fr", "es", "de")

def normalize(s: str) -> str:
    return s.strip().lower().replace("'", "’")

def texts(data: dict) -> dict[str, str]:
    result: dict[str, str] = {}
    def add(v):
        if isinstance(v, str) and v.strip():
            result.setdefault(normalize(v), v.strip())
    def fields(o, *keys):
        for k in keys:
            add(o.get(k))
    info = data.get("info", {})
    fields(info, "tagline", "products", "frozenLegend", "allergenNote")
    add(info.get("announcement", {}).get("text"))
    for n in info.get("notes", []):
        fields(n, "title", "text")
    for h in info.get("hours", []):
        fields(h, "days", "time")
    for g in data.get("groups", []):
        fields(g, "name")
    for s in data.get("sections", []):
        fields(s, "name", "subtitle", "note")
        for p in s.get("supplements", []):
            add(p.get("label"))
        for i in s.get("items", []):
            fields(i, "name", "desc", "short", "note", "allergenReviewHint")
            for p in i.get("prices", []):
                add(p.get("label"))
    for p in data.get("promos", []):
        fields(p, "title", "kicker", "text", "price")
    return result

def translators():
    from argostranslate import package, translate
    package.update_package_index()
    available = {(p.from_code, p.to_code): p for p in package.get_available_packages()}
    installed = {(p.from_code, p.to_code) for p in package.get_installed_packages()}
    def install(a, b):
        if (a, b) not in installed:
            if (a, b) not in available:
                raise RuntimeError(f"Translation model unavailable: {a} -> {b}")
            package.install_from_path(available[(a, b)].download())
            installed.add((a, b))
    install("it", "en")
    for lang in TARGETS[1:]:
        if ("it", lang) in available or ("it", lang) in installed:
            install("it", lang)
        else:
            install("en", lang)
    def convert(text, lang):
        if lang == "en":
            return translate.translate(text, "it", "en")
        if ("it", lang) in installed:
            return translate.translate(text, "it", lang)
        return translate.translate(translate.translate(text, "it", "en"), "en", lang)
    return convert

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--menu", default="data/menu.json")
    p.add_argument("--baseline", default="data/menu-i18n-baseline.json")
    p.add_argument("--previous")
    p.add_argument("--output", required=True)
    p.add_argument("--source-sha", default="")
    p.add_argument("--self-test", action="store_true")
    p.add_argument("--plan", action="store_true")
    a = p.parse_args()
    source = texts(json.loads(Path(a.menu).read_text(encoding="utf-8")))
    baseline = set(json.loads(Path(a.baseline).read_text(encoding="utf-8"))["sources"])
    old = {}
    if a.previous and Path(a.previous).is_file():
        old = json.loads(Path(a.previous).read_text(encoding="utf-8"))
        if old.get("version") != 1 or not isinstance(old.get("translations"), dict):
            raise RuntimeError("Invalid previous translation cache")
    cached = old.get("translations", {})
    pending = sorted(set(source) - baseline - set(cached))
    if a.plan:
        print(len(pending))
        return
    print(f"Existing curated texts: {len(baseline)}; cached: {len(cached)}; new or changed: {len(pending)}")
    if pending or a.self_test:
        convert = translators()
        if a.self_test:
            smoke = [convert("Pomodoro, mozzarella e basilico", l) for l in TARGETS]
            if any(not isinstance(t, str) or not t.strip() for t in smoke):
                raise RuntimeError("Translation smoke test failed")
            print("All four translation routes worked: " + repr(smoke))
        for key in pending:
            result = [convert(source[key], lang).strip() for lang in TARGETS]
            if any(not x for x in result):
                raise RuntimeError(f"Empty translation: {source[key][:80]}")
            cached[key] = result
    if old and not pending:
        output = old
    else:
        output = {"version": 1, "updatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                  "sourceSha": a.source_sha, "translations": cached}
    Path(a.output).write_text(json.dumps(output, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")

if __name__ == "__main__":
    main()
