from PIL import Image
import os

src = r"C:\Users\vivia\.grok\sessions\C%3A%5CWindows%5Csystem32\019f4f29-a248-76a1-9099-3e9cf51e68d3\assets\image-b242cefb-803f-4b62-9f9d-7ddc5f6b64a9.png"
out_dir = r"C:\Users\vivia\Desktop\MEI GABY\FLOWGEST\COPOM\public\ui"
os.makedirs(out_dir, exist_ok=True)
out = os.path.join(out_dir, "telefone-copom.png")

img = Image.open(src).convert("RGBA")
pixels = img.load()
w, h = img.size

for y in range(h):
    for x in range(w):
        r, g, b, a = pixels[x, y]
        if r > 235 and g > 235 and b > 235:
            pixels[x, y] = (r, g, b, 0)
        elif r > 215 and g > 215 and b > 215 and abs(r - g) < 14 and abs(g - b) < 14:
            brightness = (r + g + b) / 3
            alpha = int(max(0, min(255, (250 - brightness) * 10)))
            pixels[x, y] = (r, g, b, alpha)

bbox = img.getbbox()
if bbox:
    pad = 10
    l, t, r, b = bbox
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(w, r + pad)
    b = min(h, b + pad)
    img = img.crop((l, t, r, b))

img.save(out, "PNG")
print("saved", out, img.size)
