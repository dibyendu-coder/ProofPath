"""Local visual audit helper; requires PyMuPDF in .phase7-tools."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path('.phase7-tools').resolve()))
import pymupdf  # type: ignore[import-not-found]
from PIL import Image

root = Path('artifacts/phase7')
preview = root / 'previews'
preview.mkdir(exist_ok=True)
for path in sorted(root.glob('*.pdf')):
    document = pymupdf.open(path)
    text = ''.join(page.get_text() for page in document)
    payload = json.loads(path.with_suffix('.json').read_text(encoding='utf-8'))
    fingerprint = payload['fingerprint']
    out_of_bounds = 0
    for number, page in enumerate(document, 1):
        assert abs(page.rect.width - 595.28) < 1 and abs(page.rect.height - 841.89) < 1
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines', []):
                for span in line['spans']:
                    x0, y0, x1, y1 = span['bbox']
                    if x0 < 0 or y0 < 0 or x1 > page.rect.width or y1 > page.rect.height:
                        out_of_bounds += 1
        page.get_pixmap(matrix=pymupdf.Matrix(1.2, 1.2), alpha=False).save(preview / f'{path.stem}-page-{number}.png')
    thumbs = []
    for number in range(1, len(document) + 1):
        image = Image.open(preview / f'{path.stem}-page-{number}.png')
        image.thumbnail((357, 505))
        thumbs.append(image.copy())
    sheet = Image.new('RGB', (len(thumbs) * 377 + 20, 545), '#d5d3cd')
    for index, image in enumerate(thumbs):
        sheet.paste(image, (20 + index * 377, 20))
    sheet.save(preview / f'{path.stem}-contact.png')
    print(json.dumps({
        'sample': path.stem, 'pages': len(document), 'rupee': '₹1,499' in text,
        'fingerprintMatch': fingerprint in text, 'outOfBoundsSpans': out_of_bounds,
        'redactedContactAbsent': 'careers@example.org' not in text,
    }))
