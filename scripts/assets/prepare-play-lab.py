"""Prepare committed offline artwork/fonts from preserved sources.

Authoring-only dependencies: Pillow and fontTools. Runtime/CI use the committed
outputs. No content generation or repainting occurs here: images are scaled
onto a transparent crop-safe canvas and fonts instantiated at fixed weights.
"""
from pathlib import Path
import hashlib
import json

from PIL import Image
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "docs/redesign/artwork/campaign077"
OUTPUT = ROOT / "apps/mobile/assets"


def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def main():
    records = []
    (OUTPUT / "artwork").mkdir(parents=True, exist_ok=True)
    (OUTPUT / "fonts").mkdir(parents=True, exist_ok=True)
    # Explicit acceptance: drafts never become shipped media by directory scan.
    for name, version in [("workout-assembly", 1), ("memory", 1), ("attention", 1), ("logic", 2), ("math", 1), ("language", 1), ("speed", 2), ("flexibility", 2), ("spatial", 2)]:
        source = SOURCE / "sources" / f"{name}-v{version}.png"
        original = Image.open(source).convert("RGBA")
        visible_bounds = original.getchannel("A").point(lambda alpha: 255 if alpha > 16 else 0).getbbox()
        if visible_bounds is None:
            raise ValueError(f"Empty generated artwork: {source}")
        cropped = original.crop(visible_bounds)
        canvas = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
        cropped.thumbnail((358, 358), Image.Resampling.LANCZOS)
        canvas.alpha_composite(cropped, ((512 - cropped.width) // 2, (512 - cropped.height) // 2))
        target = OUTPUT / "artwork" / f"{name}.png"
        canvas.save(target, optimize=True, compress_level=9)
        records.append({
            "kind": "image", "name": name,
            "source": source.relative_to(ROOT).as_posix(),
            "sourceSha256": digest(source), "sourceBytes": source.stat().st_size,
            "output": target.relative_to(ROOT).as_posix(), "sha256": digest(target),
            "bytes": target.stat().st_size, "width": 512, "height": 512,
            "alphaExtrema": canvas.getchannel("A").getextrema(),
            "sourceVisibleBounds": visible_bounds, "visibleAlphaThreshold": 16,
            "method": "Visible-bounds crop and aspect-preserving Lanczos thumbnail onto transparent canvas; source unchanged",
            "acceptance": "source and small light/dark composites reviewed; native verification pending",
        })

    # Launcher/splash variants only composite, scale or reuse the source alpha;
    # the original mark is generated, never redrawn by this authoring script.
    source_mark = SOURCE / "sources/app-mark-v1.png"
    mark = Image.open(source_mark).convert("RGBA")
    mark = mark.crop(mark.getchannel("A").getbbox())
    brand_dir = OUTPUT / "branding"
    brand_dir.mkdir(parents=True, exist_ok=True)
    for name, side, content_side, background, monochrome in [
        ("app-icon", 1024, 704, "#F6F7FB", False),
        ("adaptive-foreground", 1024, 624, None, False),
        ("adaptive-monochrome", 1024, 624, None, True),
        ("splash-mark", 256, 224, None, False),
        ("favicon", 64, 52, "#F6F7FB", False),
    ]:
        scaled = mark.copy()
        scaled.thumbnail((content_side, content_side), Image.Resampling.LANCZOS)
        if monochrome:
            silhouette = Image.new("RGBA", scaled.size, (0, 0, 0, 0))
            silhouette.putalpha(scaled.getchannel("A"))
            scaled = silhouette
        canvas = Image.new("RGBA", (side, side), background or (0, 0, 0, 0))
        canvas.alpha_composite(scaled, ((side - scaled.width) // 2, (side - scaled.height) // 2))
        if background:
            canvas = canvas.convert("RGB")
        target = brand_dir / f"{name}.png"
        canvas.save(target, optimize=True, compress_level=9)
        records.append({
            "kind": "image", "name": name,
            "source": source_mark.relative_to(ROOT).as_posix(),
            "sourceSha256": digest(source_mark), "sourceBytes": source_mark.stat().st_size,
            "output": target.relative_to(ROOT).as_posix(), "sha256": digest(target),
            "bytes": target.stat().st_size, "width": side, "height": side,
            "alphaExtrema": canvas.getchannel("A").getextrema() if canvas.mode == "RGBA" else None,
            "method": "Alpha-bound crop, Lanczos rescale, platform canvas composite; monochrome reuses source alpha",
            "acceptance": "Original source reviewed; launcher/splash native verification pending",
        })

    source_font = SOURCE / "fonts/Manrope-variable.ttf"
    for label, weight in [("Regular", 400), ("SemiBold", 600), ("Bold", 700)]:
        variable = TTFont(source_font, recalcTimestamp=False)
        font = instantiateVariableFont(variable, {"wght": weight}, updateFontNames=True)
        font.recalcTimestamp = False
        # One native family with explicit weights: iOS reads these names from
        # the font, while Android receives matching XML definitions from Expo.
        # The variable font's instancer otherwise calls 600 a separate family.
        names = {1: "Manrope", 2: label, 4: f"Manrope {label}",
                 6: f"Manrope-{label}", 16: "Manrope", 17: label}
        for record in font["name"].names:
            if record.nameID in names:
                record.string = names[record.nameID].encode(record.getEncoding())
        target = OUTPUT / "fonts" / f"Manrope-{label}.ttf"
        font.save(target)
        records.append({
            "kind": "font", "family": font["name"].getDebugName(1),
            "subfamily": font["name"].getDebugName(2), "weight": weight,
            "source": source_font.relative_to(ROOT).as_posix(),
            "sourceSha256": digest(source_font),
            "sourceUrl": "https://github.com/google/fonts/tree/main/ofl/manrope",
            "license": "apps/mobile/assets/fonts/OFL-Manrope.txt",
            "output": target.relative_to(ROOT).as_posix(), "sha256": digest(target),
            "bytes": target.stat().st_size,
        })

    manifest = SOURCE / "manifest-initial.json"
    manifest.write_text(json.dumps({"artDirection": "Play Lab", "records": records}, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"outputs": len(records), "manifest": manifest.relative_to(ROOT).as_posix(),
                      "imageBytes": sum(r["bytes"] for r in records if r["kind"] == "image")}, indent=2))


if __name__ == "__main__":
    main()
