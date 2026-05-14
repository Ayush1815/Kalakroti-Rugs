import os
import django
import random
import pathlib
import uuid
from django.utils.text import slugify

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aura_backend.settings')
django.setup()

from django.contrib.auth.models import User
from api.models import Category, Product, ProductImage, Coupon, Collection, Tag

# Clear old data
Category.objects.all().delete()
Product.objects.all().delete()
Coupon.objects.all().delete()
Collection.objects.all().delete()
Tag.objects.all().delete()

# Create Tags (Rooms, Styles, Shapes)
rooms = ["Living Room", "Bedroom", "Dining Room", "Office", "Hallway"]
styles = ["Modern", "Traditional", "Minimal", "Bohemian", "Vintage", "Coastal"]
shapes = ["Rectangular", "Round", "Oval", "Runner"]

room_tags = [Tag.objects.create(name=r) for r in rooms]
style_tags = [Tag.objects.create(name=s) for s in styles]
shape_tags = [Tag.objects.create(name=sh) for sh in shapes]

# Create Collections
col_names = ["Jaipur", "Kashmir", "Varanasi", "Mirzapur", "Heritage", "Artisan"]
collections = [Collection.objects.create(name=n) for n in col_names]

# Create Categories
cat_data = [
    {"name": "Silk Carpets", "image_url": "/static/images/hero-1-bc2ca9.png", "order": 1},
    {"name": "Woolen Rugs", "image_url": "/static/images/hero-2-c8798d.png", "order": 2},
    {"name": "Vintage Kilims", "image_url": "/static/images/hero-4-8cbbc2.png", "order": 3},
    {"name": "Modern Abstracts", "image_url": "/static/images/silk-carpets-e7427e.jpg", "order": 4}
]
categories = {data["name"]: Category.objects.create(**data) for data in cat_data}

# Get images
from django.conf import settings
img_dir = settings.BASE_DIR.parent / 'static' / 'images' / 'Rug_Car'
all_images = []
for ext in ['*.jpg', '*.png', '*.jpeg', '*.JPG', '*.PNG', '*.JPEG']:
    all_images.extend(list(img_dir.glob(f'**/{ext}')))
all_images = [p for p in all_images if p.is_file()]
random.shuffle(all_images)

# Premium Name Components
adjectives = ["Imperial", "Royal", "Azure", "Saffron", "Velvet", "Nomadic", "Zen", "Ethereal", "Antique", "Luxe", "Handwoven"]
materials = ["Wool", "Mulberry Silk", "Organic Cotton", "Pashmina Blend", "Jute"]
techniques = ["Hand-Knotted", "Hand-Tufted", "Flatweave", "Loom-Woven"]

realistic_discounted_prices = [2599, 2999, 3399, 2249, 4999, 5499, 7999, 8999, 12999, 15999, 18999, 24999]

products_created = 0

for idx, img_path in enumerate(all_images[:50], start=1):
    rel_path = img_path.relative_to(settings.BASE_DIR / 'images')
    image_url = f"/images/{rel_path.as_posix()}"

    cat = random.choice(list(categories.values()))
    col = random.choice(collections)
    adj = random.choice(adjectives)
    mat = random.choice(materials)
    tech = random.choice(techniques)
    
    # Premium naming e.g., "Beige Handwoven Wool Rug – Jaipur Collection"
    color = random.choice(["Beige", "Deep Crimson", "Indigo", "Sandstone", "Emerald", "Ochre"])
    title = f"{color} {adj} {tech} {mat} Rug – {col.name} Collection"
    
    discounted = random.choice(realistic_discounted_prices)
    # Original price calculation (30-50% discount)
    discount_pct = random.uniform(0.3, 0.5)
    original = int(discounted / (1 - discount_pct))
    original = (original // 100 * 100) + 99 # Make it look like 3999, 4999 etc
    
    if original <= discounted:
        original = discounted + 1000

    prod = Product.objects.create(
        category=cat,
        collection=col,
        title=title,
        slug=slugify(f"{title}-{uuid.uuid4().hex[:4]}"),
        short_description=f"A masterpiece of {tech.lower()} artistry from {col.name}.",
        description=f"Elevate your home with the {title}. This exquisite piece is a testament to the skill of our master weavers in {col.name}. Every thread of {mat.lower()} is carefully placed to create a design that is both timeless and contemporary.",
        price=original,
        discount_price=discounted,
        sku=str(uuid.uuid4().hex)[:12].upper(),
        stock_quantity=random.randint(2, 15),
        main_image=image_url,
        hover_image=image_url,
        size=random.choice(["6x9 ft", "8x10 ft", "9x12 ft", "2.5x8 ft"]),
        shape=random.choice(["Rectangle", "Round", "Oval", "Runner", "Square"]),
        space=random.choice(["Living Room", "Bedroom", "Dining Room", "Hallway", "Office"]),
        material=mat,
        weave_type=random.choice(['hand_knotted', 'hand_tufted']),
        origin=f"{col.name}, India",
        is_featured=(idx <= 12),
        is_new_arrival=(random.random() > 0.7),
        is_best_seller=(random.random() > 0.8),
        pattern_style=random.choice(["Floral", "Geometric", "Abstract", "Traditional"]),
    )
    
    # Classify into tags
    assigned_tags = [
        random.choice(room_tags),
        random.choice(style_tags),
        random.choice(shape_tags)
    ]
    prod.tags.add(*assigned_tags)
    
    ProductImage.objects.create(product=prod, image_url=prod.main_image, order=0)
    products_created += 1

print(f"Database re-seeded with {products_created} premium products.")
