"""Spindledeep app icon: an engraved spindle wound with red thread, on ink. Writes build/icon.png + build/icon.ico."""
import math, os
from PIL import Image, ImageDraw, ImageFilter
ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
S = 1024
INK, PAPER, RED = (13, 11, 18), (232, 220, 196), (214, 34, 40)
im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
d.rounded_rectangle((24, 24, S - 24, S - 24), radius=190, fill=INK)
# engraved horizontal lines of a pale moon behind
for y in range(150, 760, 11):
    w = math.sqrt(max(0, 300 ** 2 - (y - 455) ** 2))
    if w > 0:
        d.line((512 - w, y, 512 + w, y), fill=(PAPER[0], PAPER[1], PAPER[2], 70), width=4)
# spindle shaft
d.polygon([(500, 150), (524, 150), (540, 880), (484, 880)], fill=PAPER)
for y in range(170, 870, 9):
    d.line((496, y, 528, y), fill=INK, width=2)
# whorl
d.ellipse((380, 740, 644, 820), fill=PAPER, outline=INK, width=6)
for x in range(392, 640, 10):
    d.line((x, 748, x, 812), fill=INK, width=2)
# the wound red yarn: a cop of thread on the shaft
cop = Image.new('RGBA', (S, S), (0, 0, 0, 0)); c = ImageDraw.Draw(cop)
for i in range(46):
    y = 330 + i * 8.5
    w = 105 * math.sin(math.pi * (i + 1) / 47) + 30
    c.arc((512 - w, y - 18, 512 + w, y + 18), 200, 340, fill=RED, width=7)
    c.arc((512 - w, y - 18, 512 + w, y + 18), 20, 160, fill=(150, 18, 24), width=5)
im.alpha_composite(cop)
# a loose end trailing away and down
pts = [(600, 520), (690, 560), (760, 650), (800, 760), (830, 900)]
glow = Image.new('RGBA', (S, S), (0, 0, 0, 0)); g = ImageDraw.Draw(glow)
g.line(pts, fill=(255, 60, 50, 160), width=34, joint='curve')
glow = glow.filter(ImageFilter.GaussianBlur(22))
im.alpha_composite(glow)
d = ImageDraw.Draw(im)
d.line(pts, fill=RED, width=11, joint='curve')
os.makedirs(os.path.join(ROOT, 'build'), exist_ok=True)
im.save(os.path.join(ROOT, 'build', 'icon.png'))
im.save(os.path.join(ROOT, 'build', 'icon.ico'), sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
print('icon written')
