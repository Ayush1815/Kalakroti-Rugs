import os
from pathlib import Path
from django.core.management import BaseCommand
from django.utils.text import slugify
from django.conf import settings
from django.db import transaction

from api.models import Category, Collection, Product, ProductImage, Tag

PREMIUM_CONTENT = {
    "09": {"title": "Imperial Sapphire Silk Masterpiece", "cat": "Silk Carpets", "space": "Formal Living", "price": 145000, "material": "100% Pure Mulberry Silk", "desc": "Elevate your living room into a sanctuary of luxury. This hand-knotted silk masterpiece features intricate sapphire medallions that shimmer under the light, bringing a timeless, soothing elegance to your home.", "tags": ["Traditional", "Luxury", "Living Room"]},
    "18": {"title": "Ochre Nomad Flatweave Kilim", "cat": "Vintage Kilims", "space": "Dining Room", "price": 42000, "material": "Handspun Highland Wool", "desc": "A breathtaking vintage kilim woven with earthy ochre tones. Its geometric patterns anchor any space with bohemian charm. Perfect for dining areas or relaxed lounges. Spot clean spills immediately to maintain its heirloom quality.", "tags": ["Bohemian", "Vintage", "Dining Room"]},
    "21": {"title": "Ivory Cloud Hand-Tufted Wool", "cat": "Woolen Rugs", "space": "Bedroom", "price": 55000, "material": "Plush Wool Blend", "desc": "Transform your bedroom into a cozy retreat. The luxuriously thick pile of this ivory rug soothes your feet every morning. Loom-woven for durability, it pairs perfectly with modern or mid-century furniture.", "tags": ["Modern", "Cozy", "Bedroom"]},
    "22": {"title": "Charcoal Abstract Canvas", "cat": "Modern Abstracts", "space": "Office", "price": 68000, "material": "Wool & Viscose Highlight", "desc": "Make a bold statement in your workspace. This abstract contemporary piece uses charcoal and silver tones to create a sophisticated, museum-quality floor canvas. Vacuum regularly without a beater bar for best care.", "tags": ["Abstract", "Contemporary", "Office"]},
    "23": {"title": "Crimson Heritage Loom", "cat": "Traditional", "space": "Library", "price": 95000, "material": "Wool & Silk Blend", "desc": "A tribute to ancient weaving methods, this deep crimson rug exudes majesty. Ideal for a study or library, it elevates your environment with rich heritage and unparalleled craftsmanship.", "tags": ["Traditional", "Classic", "Library"]},
    "24": {"title": "Sage Green Serenity Mat", "cat": "Modern Abstracts", "space": "Living Room", "price": 49000, "material": "Bamboo Silk", "desc": "Bring the tranquility of nature indoors. This sage green rug features a delicate, lustrous sheen that breathes life into boring spaces, making them feel fresh, airy, and deeply luxurious.", "tags": ["Minimalist", "Calm", "Living Room"]},
    "25": {"title": "Golden Hour Geometric Runner", "cat": "Vintage Kilims", "space": "Hallway", "price": 35000, "material": "Jute & Cotton", "desc": "Welcome guests with warmth. This vibrant runner is woven to withstand high traffic while maintaining its striking golden geometric design. A durable, eco-friendly addition to your hallway.", "tags": ["Geometric", "Runner", "Hallway"]},
    "26": {"title": "Midnight Blue Starry Weave", "cat": "Silk Carpets", "space": "Master Bedroom", "price": 110000, "material": "Pure Silk & Wool", "desc": "Drift into relaxation. The midnight blue field is dotted with intricate floral motifs that resemble a starry night. Professionally wash only to preserve its delicate, lustrous pile.", "tags": ["Luxury", "Floral", "Bedroom"]},
    "28": {"title": "Terracotta Sunset Wool Rug", "cat": "Woolen Rugs", "space": "Lounge", "price": 72000, "material": "Highland Wool", "desc": "Infuse your lounge with the warmth of a terracotta sunset. Hand-knotted for ultimate resilience, this rug provides a soft, inviting foundation that ties your entire room's aesthetic together.", "tags": ["Warm", "Hand-knotted", "Lounge"]},
    "29": {"title": "Ash Grey Minimalist Square", "cat": "Modern Abstracts", "space": "Studio", "price": 45000, "material": "Wool & Linen", "desc": "Sleek, understated, and incredibly chic. This ash grey square rug is the definition of modern minimalism. It provides a quiet, sophisticated backdrop that lets your furniture shine.", "tags": ["Minimalist", "Grey", "Studio"]},
    "34": {"title": "Ruby Persian Heritage", "cat": "Traditional", "space": "Formal Dining", "price": 135000, "material": "Wool & Silk Highlight", "desc": "An absolute showstopper. The rich ruby tones and classic Persian medallions are woven using techniques passed down for generations. It instantly upgrades a basic dining room into a grand hall.", "tags": ["Persian", "Heritage", "Dining Room"]},
    "35": {"title": "Blush Pink Silk Accent", "cat": "Silk Carpets", "space": "Dressing Room", "price": 52000, "material": "Mulberry Silk", "desc": "A delicate, romantic touch for your intimate spaces. This blush pink silk accent rug is incredibly soft to the touch, reflecting light beautifully to brighten your dressing room or nursery.", "tags": ["Soft", "Pink", "Accent"]},
    "39": {"title": "Desert Sand Flatweave", "cat": "Vintage Kilims", "space": "Sunroom", "price": 38000, "material": "Cotton & Jute", "desc": "Earthy and organic. The desert sand tones of this flatweave rug bring a natural, grounded feel to any sunroom or patio enclosure. Extremely easy to maintain and highly durable.", "tags": ["Earthy", "Organic", "Sunroom"]},
    "42": {"title": "Emerald Forest Tufted Rug", "cat": "Woolen Rugs", "space": "Living Room", "price": 85000, "material": "Plush Highland Wool", "desc": "Deep, mesmerizing emerald greens that soothe the soul. This thick, tufted wool rug is a statement piece that pairs gorgeously with brass accents and dark wood furniture.", "tags": ["Green", "Tufted", "Living Room"]},
    "45": {"title": "Monochrome Grid Canvas", "cat": "Modern Abstracts", "space": "Office", "price": 59000, "material": "Wool Blend", "desc": "Sharp, clean, and professional. The monochrome grid design is perfect for a modern home office, providing a structured yet comfortable foundation for your workspace.", "tags": ["Grid", "Black & White", "Office"]},
    "47": {"title": "Azure Coastal Weave", "cat": "Traditional", "space": "Guest Room", "price": 64000, "material": "Wool & Cotton", "desc": "Bring the calming energy of the coast into your home. The soft azure blues and traditional borders make your guest room feel like a luxurious getaway suite.", "tags": ["Blue", "Coastal", "Guest Room"]},
    "49": {"title": "Rustic Bronze Medallion", "cat": "Vintage Kilims", "space": "Dining Room", "price": 51000, "material": "Handspun Wool", "desc": "A vintage treasure. The rustic bronze and copper tones add incredible warmth and character. Its flatweave construction makes it ideal for sliding dining chairs with ease.", "tags": ["Rustic", "Bronze", "Dining Room"]},
    "50": {"title": "Alabaster Silk Masterpiece", "cat": "Silk Carpets", "space": "Living Room", "price": 160000, "material": "Pure Mulberry Silk", "desc": "The pinnacle of luxury. This alabaster silk rug shimmers beautifully, opening up your space and reflecting light to make your living room feel massive, airy, and undeniably opulent.", "tags": ["Luxury", "White", "Living Room"]},
}

class Command(BaseCommand):
    help = "Seed Kalakroti catalog dynamically from Rug_Car directory."

    def add_arguments(self, parser):
        parser.add_argument("--if-empty", action="store_true", help="Only seed when no products exist.")

    def handle(self, *args, **options):
        if options["if_empty"] and Product.objects.exists():
            self.stdout.write(self.style.SUCCESS("Catalog already has products. Seed skipped."))
            return

            # Support both "Rug Car" (with space) and "Rug_Car" (with underscore)
            base_dir = Path(settings.MEDIA_ROOT) / "Rug Car"
            if not base_dir.exists():
                base_dir = Path(settings.MEDIA_ROOT) / "Rug_Car"

            if not base_dir.exists():
                self.stdout.write(self.style.ERROR("Directory 'Rug Car' or 'Rug_Car' not found under MEDIA_ROOT."))
                return

            with transaction.atomic():
                self.stdout.write("Clearing existing products...")
                Product.objects.all().delete()
                Category.objects.all().delete()
                Tag.objects.all().delete()
                
                categories_map = {}
                created = 0
                
                for folder_name, content in PREMIUM_CONTENT.items():
                    folder_path = base_dir / folder_name
                    if not folder_path.exists():
                        self.stdout.write(self.style.WARNING(f"Skipping {folder_name}: Directory missing"))
                        continue
                    
                    images = sorted([img for img in folder_path.iterdir() if img.suffix.lower() in ['.jpg', '.png', '.jpeg']])
                    if not images:
                        self.stdout.write(self.style.WARNING(f"Skipping {folder_name}: No images found"))
                        continue

                    # Ensure Category exists
                    cat_name = content["cat"]
                    if cat_name not in categories_map:
                        categories_map[cat_name] = Category.objects.create(
                            name=cat_name, slug=slugify(cat_name), image_url="/static/images/hero-1-bc2ca9.png"
                        )

                    category = categories_map[cat_name]
                    
                    # Image URLs (Dynamic directory name support)
                    main_image_url = f"/images/{base_dir.name}/{folder_name}/{images[0].name}"
                    hover_image_url = f"/images/{base_dir.name}/{folder_name}/{images[1].name}" if len(images) > 1 else None

                # Create Product
                product = Product.objects.create(
                    category=category,
                    title=content["title"],
                    slug=slugify(content["title"]),
                    short_description=f"{content['material']} crafted for {content['space']} spaces.",
                    description=content["desc"],
                    price=content["price"],
                    discount_price=int(content["price"] * 0.85), # 15% off
                    sku=f"KALA-RUG-{folder_name}",
                    stock_quantity=5,
                    main_image=main_image_url,
                    hover_image=hover_image_url,
                    size="8x10 ft",
                    space=content["space"],
                    material=content["material"],
                    is_featured=(created < 8),
                    status="published"
                )

                # Tags
                for tag_name in content["tags"]:
                    tag, _ = Tag.objects.get_or_create(name=tag_name)
                    product.tags.add(tag)

                # Gallery
                for idx, img_path in enumerate(images):
                    ProductImage.objects.create(
                        product=product,
                        image_url=f"/images/{base_dir.name}/{folder_name}/{img_path.name}",
                        order=idx
                    )

                created += 1

            self.stdout.write(self.style.SUCCESS(f"Seed complete. Successfully built {created} products from {base_dir.name} directory."))
