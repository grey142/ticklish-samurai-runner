#!/usr/bin/env python3
"""Flood-fill studio backdrops and crop gameplay sprites to transparent PNG."""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "public" / "assets"
FOLDERS = [ROOT / "player", ROOT / "enemies", ROOT / "projectiles"]


def is_bg(px: tuple[int, int, int], bg: tuple[float, float, float]) -> bool:
    r, g, b = px[:3]
    avg = (r + g + b) / 3
    chroma = max(r, g, b) - min(r, g, b)
    dist = abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2])
    return (avg > 196 and chroma < 32) or dist < 48


def knockout(path: Path) -> None:
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    pix = im.load()
    samples = [pix[2, 2], pix[w - 3, 2], pix[2, h - 3], pix[w - 3, h - 3]]
    bg = (
        sum(p[0] for p in samples) / 4,
        sum(p[1] for p in samples) / 4,
        sum(p[2] for p in samples) / 4,
    )
    seen = bytearray(w * h)
    stack: list[int] = []

    def push(x: int, y: int) -> None:
        if x < 0 or y < 0 or x >= w or y >= h:
            return
        idx = y * w + x
        if seen[idx]:
            return
        if not is_bg(pix[x, y], bg):
            return
        seen[idx] = 1
        stack.append(idx)

    for x in range(w):
        push(x, 0)
        push(x, h - 1)
    for y in range(h):
        push(0, y)
        push(w - 1, y)
    while stack:
        idx = stack.pop()
        x, y = idx % w, idx // w
        pix[x, y] = (0, 0, 0, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            push(x + dx, y + dy)

    bbox = im.getbbox()
    if not bbox:
        return
    pad = 4
    l, t, r, b = bbox
    crop = im.crop((max(0, l - pad), max(0, t - pad), min(w, r + pad), min(h, b + pad)))
    crop.save(path, "PNG", optimize=True)
    print(f"ok {path.relative_to(ROOT)} {im.size} -> {crop.size}")


def main() -> None:
    skip = {"ref.jpg", "run-sheet.png"}
    for folder in FOLDERS:
        for path in sorted(folder.rglob("*")):
            if not path.is_file() or path.name in skip:
                continue
            if path.suffix.lower() not in {".png", ".jpg", ".jpeg"}:
                continue
            knockout(path)


if __name__ == "__main__":
    main()
