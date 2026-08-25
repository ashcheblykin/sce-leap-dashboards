#!/usr/bin/env python3
"""Rebuild assets/fonts/ from the vendored Noto Sans subsets in axion.gen.web.

The upstream files are already variable-font subsets (wdth pinned to 100, wght
300-700) covering whole scripts: latin + latin-ext + cyrillic in one 226 KB
file, arabic in another 116 KB one. This board needs neither Cyrillic nor most
of latin-ext, and it uses a knowable set of Arabic words, so subsetting to what
is actually on screen takes ~340 KB down to ~55 KB. In a single-file deliverable
that is base64 in the HTML, so it is ~75 KB off the wire per font saved.

Run it whenever the text changes:

    PATH="<venv>/bin:$PATH" python3 tools/subset-fonts.py

It derives the character set from the sources rather than from a hand-kept list,
so "the text changed" and "the subset is stale" cannot drift apart. The Latin
face additionally keeps all of Basic Latin whether or not it is currently used:
it is 95 glyphs, the numbers and units are built at runtime, and a missing digit
on a wall is not a risk worth 2 KB.

Requires fonttools + brotli (`pip install fonttools brotli`).
"""

import os
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
SRC = Path.home() / 'Documents/DEV/axion.gen.web/frontend/src/app/fonts'
OUT = APP / 'assets/fonts'

FACES = [
    # (upstream file, output file, script test)
    ('noto-sans-latin-cyrillic.woff2', 'noto-sans-latin.woff2', 'latin'),
    ('noto-sans-arabic.woff2', 'noto-sans-arabic.woff2', 'arabic'),
]

# Scanned for text. Data files are included: LEAP carries the Arabic city and
# profession names, and they are the bulk of the Arabic glyph set.
SOURCES = (
    list((APP / 'assets/js').rglob('*.js'))
    + list((APP / 'assets/css').rglob('*.css'))
    + [APP / 'index.html']
)

# Always present in the Latin face regardless of the scan.
ALWAYS_LATIN = (
    ''.join(chr(c) for c in range(0x20, 0x7F))  # Basic Latin
    + ' «»°·×÷'
    + '–—‘’“”•…‰'
    + '−≈≤≥←↑→↓'
)

# Always present in the Arabic face: the marks that hold a word together plus
# the Arabic comma and full stop.
ALWAYS_ARABIC = 'ـًٌٍَُِّْٰٓٔ،؛؟۔‌‍‎‏'


def is_arabic(ch: str) -> bool:
    cp = ord(ch)
    return (
        0x0600 <= cp <= 0x06FF
        or 0x0750 <= cp <= 0x077F
        or 0x08A0 <= cp <= 0x08FF
        or 0xFB50 <= cp <= 0xFDFF
        or 0xFE70 <= cp <= 0xFEFF
    )


def scan() -> tuple[set[str], set[str]]:
    latin, arabic = set(ALWAYS_LATIN), set(ALWAYS_ARABIC)
    for path in SOURCES:
        text = path.read_text(encoding='utf-8', errors='replace')
        # A woff2/webp data URI inside a source file is base64, not text.
        text = re.sub(r'data:[^\'")\s]+', '', text)
        for ch in text:
            if ch in ('\n', '\r', '\t'):
                continue
            if is_arabic(ch):
                arabic.add(ch)
            elif ord(ch) > 0x1F and unicodedata.category(ch)[0] != 'C':
                latin.add(ch)
    return latin, arabic


def subset(src: Path, dst: Path, chars: set[str]) -> None:
    text = ''.join(sorted(chars))
    tmp = dst.parent / (dst.name + '.chars')
    tmp.write_text(text, encoding='utf-8')
    cmd = [
        'pyftsubset',
        str(src),
        f'--text-file={tmp}',
        # Arabic shaping lives in GSUB/GPOS: keeping every layout feature makes
        # the subsetter pull in the contextual forms of the letters we kept.
        "--layout-features=*",
        '--flavor=woff2',
        '--no-hinting',
        '--desubroutinize',
        f'--output-file={dst}',
    ]
    subprocess.run(cmd, check=True)
    tmp.unlink()


def main() -> int:
    if not SRC.is_dir():
        print(f'upstream fonts not found: {SRC}', file=sys.stderr)
        return 1
    OUT.mkdir(parents=True, exist_ok=True)
    latin, arabic = scan()
    print(f'scanned {len(SOURCES)} files -> {len(latin)} latin, {len(arabic)} arabic characters')

    total_before = total_after = 0
    for src_name, dst_name, script in FACES:
        src = SRC / src_name
        dst = OUT / dst_name
        chars = latin if script == 'latin' else arabic
        before = src.stat().st_size
        subset(src, dst, chars)
        after = dst.stat().st_size
        total_before += before
        total_after += after
        print(
            f'  {dst_name:28s} {before / 1024:7.1f} KB -> {after / 1024:6.1f} KB'
            f'  ({100 * after / before:.0f}%)'
        )
    print(f'  {"total":28s} {total_before / 1024:7.1f} KB -> {total_after / 1024:6.1f} KB')

    stale = OUT / 'noto-sans-latin-cyrillic.woff2'
    if stale.exists():
        stale.unlink()
        print(f'  removed superseded {stale.name}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
