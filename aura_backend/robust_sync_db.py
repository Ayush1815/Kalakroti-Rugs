import os
import json
import django
import re
from pathlib import Path

# Paths
BASE_DIR = Path(r"d:\Placement\Rugs and Antiques - Copy")
ASSET_MAP_FILE = BASE_DIR / "asset_map.json"

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aura_backend.settings')
django.setup()

from api.models import Product, ProductImage, Category

def robust_update_db():
    with open(ASSET_MAP_FILE, 'r') as f:
        mapping = json.load(f)
    
    # Sort mapping by key length descending
    sorted_items = sorted(mapping.items(), key=lambda x: len(x[0]), reverse=True)

    def replace_all(text):
        if not text: return text
        new_text = text
        for old, new in sorted_items:
            # Case-insensitive replacement using regex
            pattern = re.compile(re.escape(old), re.IGNORECASE)
            new_text = pattern.sub(new, new_text)
        return new_text

    # Update Products
    p_count = 0
    for p in Product.objects.all():
        old_main = p.main_image
        old_hover = p.hover_image
        p.main_image = replace_all(p.main_image)
        p.hover_image = replace_all(p.hover_image)
        if p.main_image != old_main or p.hover_image != old_hover:
            p.save()
            p_count += 1
            
    # Update ProductImages
    i_count = 0
    for img in ProductImage.objects.all():
        old_url = img.image_url
        img.image_url = replace_all(img.image_url)
        if img.image_url != old_url:
            img.save()
            i_count += 1

    # Update Categories
    c_count = 0
    for c in Category.objects.all():
        old_url = c.image_url
        c.image_url = replace_all(c.image_url)
        if c.image_url != old_url:
            c.save()
            c_count += 1

    print(f"Robust DB Update: {p_count} products, {i_count} images, {c_count} categories.")

if __name__ == "__main__":
    robust_update_db()
