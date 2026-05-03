"""
Generate a 1080x1080 square OG image optimized for WhatsApp / iMessage
small-thumbnail link previews. Composes the GroundWork icon with the
wordmark and tagline on the brand-dark background.

Output: public/og-square.png
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
LOGO_PATH = ROOT / "public" / "icon" / "icon-512.png"
OUT_PATH = ROOT / "public" / "og-square.png"

CANVAS = (1080, 1080)
BG = (15, 17, 23)                # matches splash backgroundColor in capacitor.config.ts
GROUND_COLOR = (235, 235, 235)   # #ebebeb — matches Keycloak header
WORK_COLOR = (232, 185, 58)      # #e8b93a — matches Keycloak header
TAGLINE_COLOR = (160, 165, 175)

WORDMARK_FONTS = [
    "C:/Windows/Fonts/seguibl.ttf",   # Segoe UI Black
    "C:/Windows/Fonts/arialbd.ttf",   # Arial Bold
]


def load_font(size: int) -> ImageFont.FreeTypeFont:
    for path in WORDMARK_FONTS:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def text_size(draw: ImageDraw.ImageDraw, text: str, font) -> tuple[float, int]:
    w = draw.textlength(text, font=font)
    bbox = font.getbbox(text)
    h = bbox[3] - bbox[1]
    return w, h


def main() -> None:
    canvas = Image.new("RGB", CANVAS, BG)
    draw = ImageDraw.Draw(canvas)

    logo_size = 460
    logo = Image.open(LOGO_PATH).convert("RGBA").resize((logo_size, logo_size), Image.LANCZOS)

    wordmark_font = load_font(140)
    ground_w, wordmark_h = text_size(draw, "Ground", wordmark_font)
    work_w, _ = text_size(draw, "Work", wordmark_font)
    wordmark_w = ground_w + work_w

    tagline_font = load_font(56)
    tagline = "Log anything. From anywhere."
    tagline_w, tagline_h = text_size(draw, tagline, tagline_font)

    gap_logo_to_wordmark = 40
    gap_wordmark_to_tagline = 28

    unit_h = logo_size + gap_logo_to_wordmark + wordmark_h + gap_wordmark_to_tagline + tagline_h
    unit_top = (CANVAS[1] - unit_h) // 2

    logo_x = (CANVAS[0] - logo_size) // 2
    logo_y = unit_top
    canvas.paste(logo, (logo_x, logo_y), logo)

    wordmark_left = (CANVAS[0] - wordmark_w) / 2
    wordmark_y = logo_y + logo_size + gap_logo_to_wordmark
    draw.text((wordmark_left, wordmark_y), "Ground", font=wordmark_font, fill=GROUND_COLOR)
    draw.text((wordmark_left + ground_w, wordmark_y), "Work", font=wordmark_font, fill=WORK_COLOR)

    tagline_left = (CANVAS[0] - tagline_w) / 2
    tagline_y = wordmark_y + wordmark_h + gap_wordmark_to_tagline
    draw.text((tagline_left, tagline_y), tagline, font=tagline_font, fill=TAGLINE_COLOR)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT_PATH, "PNG", optimize=True)
    print(f"wrote {OUT_PATH} ({CANVAS[0]}x{CANVAS[1]})")


if __name__ == "__main__":
    main()
