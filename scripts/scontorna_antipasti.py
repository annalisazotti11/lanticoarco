#!/usr/bin/env python3
"""Prepara sette foto REALI degli antipasti L'Antico Arco, senza ricreare i prodotti.

Gli originali img/menu/media-*.webp restano intatti.
Genera PNG con trasparenza, lieve correzione fotografica, controllo delle maschere
e aggiorna soltanto i 7 riferimenti corrispondenti in data/menu.json.
"""
from __future__ import annotations

import json
import warnings
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageOps
from rembg import new_session, remove

BASE = Path(__file__).resolve().parents[1]
SOURCE = BASE / "img" / "menu"
DEST = SOURCE / "antipasti-rifiniti"
MENU = BASE / "data" / "menu.json"
AUDIT = DEST / "risultati.json"

ITEMS = [
    ("i431", "media-161.webp", "peperone-crusco-senise"),
    ("i433", "media-78.webp", "prosciutto-cotto"),
    ("i434", "media-73.webp", "prosciutto-crudo-alla-barese"),
    ("i442", "media-113.webp", "tagliere-formaggi-murgiani"),
    ("i441", "media-99.webp", "tagliere-salumi-misti"),
    ("i443", "media-137.webp", "taralli-scaldatelli"),
    ("i444", "media-140.webp", "verdure-miste-sottolio"),
]


def get_session():
    try:
        return new_session("u2net")
    except Exception as exc:
        warnings.warn(f"u2net non disponibile ({exc}); provo u2netp")
        return new_session("u2netp")


# Coordinate misurate sulle fotografie ORIGINALI: non eliminare anche i piatti.
# Le maschere vengono aggiunte (non sostituite) al ritaglio del modello.
DISH_SHAPES = {
    "media-161.webp": ("ellipse", [40, 16, 171, 129]),
    "media-78.webp": ("polygon", [
        (116, 126), (354, 126), (400, 145), (427, 331),
        (410, 349), (92, 352), (70, 340), (71, 179),
    ]),
    "media-137.webp": ("polygon", [
        (109, 153), (362, 155), (404, 171), (412, 354),
        (382, 384), (93, 393), (72, 373), (75, 183),
    ]),
}


def keep_original_plate(src_name: str, alpha: Image.Image, scale: float) -> Image.Image:
    shape = DISH_SHAPES.get(src_name)
    if not shape:
        return alpha
    kind, coords = shape
    plate = Image.new("L", alpha.size, 0)
    drawing = ImageDraw.Draw(plate)
    if kind == "ellipse":
        drawing.ellipse([round(v*scale) for v in coords], fill=255)
    else:
        drawing.polygon([(round(x*scale), round(y*scale)) for x,y in coords], fill=255)
    plate = plate.filter(ImageFilter.GaussianBlur(radius=max(0.8, 0.7*scale)))
    return ImageChops.lighter(alpha, plate)


def prepare(src: Path, out: Path, session) -> dict:
    photo = ImageOps.exif_transpose(Image.open(src)).convert("RGBA")
    original_width, original_height = photo.size
    # Il modello vede piatti e contorni meglio su immagini di almeno 800 px.
    scale = max(1.0, 800.0 / max(photo.size))
    size = (round(original_width * scale), round(original_height * scale))
    enlarged = photo.resize(size, Image.Resampling.LANCZOS) if scale > 1 else photo.copy()
    cutout = remove(enlarged, session=session, post_process_mask=True)
    if not isinstance(cutout, Image.Image):
        from io import BytesIO
        cutout = Image.open(BytesIO(cutout))
    cutout = cutout.convert("RGBA")
    alpha = keep_original_plate(src.name, cutout.getchannel("A"), scale)

    visible = sum(1 for p in alpha.resize((128, 128)).getdata() if p > 80)
    coverage = visible / (128 * 128)
    if coverage < 0.045 or coverage > 0.93:
        raise RuntimeError(f"Maschera sospetta per {src.name}: {coverage:.1%} pixel visibili")

    # Ritocco leggero non generativo: non inventa né sposta alimenti.
    rgb = enlarged.convert("RGB")
    rgb = ImageEnhance.Brightness(rgb).enhance(1.045)
    rgb = ImageEnhance.Contrast(rgb).enhance(1.055)
    rgb = ImageEnhance.Color(rgb).enhance(1.025)
    rgb = rgb.filter(ImageFilter.UnsharpMask(radius=1.0, percent=75, threshold=3))
    rgb.putalpha(alpha)
    bbox = alpha.getbbox()
    if bbox is None:
        raise RuntimeError(f"Nessun soggetto individuato in {src}")
    crop = rgb.crop(bbox)
    cw, ch = crop.size

    # Conserva l'intera inquadratura del soggetto e 6% di bordo trasparente.
    canvas_size = 1024
    margin = 64
    factor = min((canvas_size-2*margin)/cw, (canvas_size-2*margin)/ch)
    display_size = (round(cw*factor), round(ch*factor))
    crop = crop.resize(display_size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0,0,0,0))
    x = (canvas_size-display_size[0])//2
    y = (canvas_size-display_size[1])//2
    canvas.alpha_composite(crop, (x, y))
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out, format="PNG", optimize=True)
    return {
        "source": str(src.relative_to(BASE)),
        "output": str(out.relative_to(BASE)),
        "source_size": [original_width, original_height],
        "output_size": [canvas_size, canvas_size],
        "foreground_coverage": round(coverage, 4),
        "note": "Scontorno automatico da verificare visivamente prima della pubblicazione",
    }


def main():
    session = get_session()
    records = []
    changes = {}
    for item_id, original, slug in ITEMS:
        src = SOURCE / original
        out = DEST / f"{slug}.png"
        if not src.is_file():
            raise FileNotFoundError(src)
        details = prepare(src, out, session)
        details["item_id"] = item_id
        records.append(details)
        changes[item_id] = details["output"]
        print(f"OK: {original} -> {out.name}")

    data = json.loads(MENU.read_text(encoding="utf-8"))
    section = next(x for x in data["sections"] if x["id"] == "s36")
    changed = set()
    for item in section["items"]:
        if item["id"] in changes:
            item["image"] = changes[item["id"]]
            changed.add(item["id"])
    if changed != set(changes):
        raise RuntimeError(f"ID mancanti dal menu: {set(changes)-changed}")

    # Le modifiche restano nel branch di revisione; main e originali non si toccano.
    MENU.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    DEST.mkdir(parents=True, exist_ok=True)
    AUDIT.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Preparate 7 fotografie. Verificare tutti i ritagli prima del merge.")


if __name__ == "__main__":
    main()
