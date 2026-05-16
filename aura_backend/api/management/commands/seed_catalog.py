from django.core.management import BaseCommand
from django.utils.text import slugify

from api.models import Category, Collection, Product, ProductImage, Tag


SAMPLE_CATEGORIES = [
    {"name": "Silk Carpets", "slug": "silk-carpets", "image_url": "/static/images/silk-carpets-e7427e.jpg", "order": 1},
    {"name": "Woolen Rugs", "slug": "woolen-rugs", "image_url": "/static/images/woolen-rugs-28654e.jpg", "order": 2},
    {"name": "Vintage Kilims", "slug": "vintage-kilims", "image_url": "/static/images/vintage-kilims-3112c8.jpg", "order": 3},
    {"name": "Modern Abstracts", "slug": "modern-abstracts", "image_url": "/static/images/modern-abstracts-3813de.jpg", "order": 4},
]

SAMPLE_PRODUCTS = [
    {
        "category": "Silk Carpets",
        "collection": "Kashmir",
        "title": "Sapphire Medallion Silk Carpet",
        "price": 148000,
        "discount_price": 118000,
        "main_image": "/static/images/silk-carpets-e7427e.jpg",
        "hover_image": "/static/images/hero-3-26995d.jpg",
        "size": "8x10 ft",
        "shape": "Rectangle",
        "space": "Living Room",
        "material": "Mulberry Silk",
        "origin": "Kashmir, India",
        "pattern_style": "Traditional",
        "tags": ["Traditional", "Living Room"],
        "featured": True,
        "new": True,
        "best": True,
    },
    {
        "category": "Woolen Rugs",
        "collection": "Jaipur",
        "title": "Amber Garden Hand-Knotted Wool Rug",
        "price": 62000,
        "discount_price": 49900,
        "main_image": "/static/images/hero-1-bc2ca9.png",
        "hover_image": "/static/images/woolen-rugs-28654e.jpg",
        "size": "6x9 ft",
        "shape": "Rectangle",
        "space": "Bedroom",
        "material": "Highland Wool",
        "origin": "Jaipur, India",
        "pattern_style": "Floral",
        "tags": ["Floral", "Bedroom"],
        "featured": True,
        "new": True,
        "best": False,
    },
    {
        "category": "Vintage Kilims",
        "collection": "Mirzapur",
        "title": "Rust Nomad Vintage Kilim",
        "price": 42000,
        "discount_price": 34900,
        "main_image": "/static/images/vintage-kilims-3112c8.jpg",
        "hover_image": "/static/images/hero-4-8cbbc2.png",
        "size": "5x8 ft",
        "shape": "Rectangle",
        "space": "Dining Room",
        "material": "Wool Cotton Blend",
        "origin": "Mirzapur, India",
        "pattern_style": "Geometric",
        "tags": ["Geometric", "Dining Room"],
        "featured": True,
        "new": False,
        "best": True,
    },
    {
        "category": "Modern Abstracts",
        "collection": "Bhadohi",
        "title": "Ivory Abstract Studio Rug",
        "price": 54000,
        "discount_price": 45900,
        "main_image": "/static/images/modern-abstracts-3813de.jpg",
        "hover_image": "/static/images/style-modern.png",
        "size": "8x10 ft",
        "shape": "Rectangle",
        "space": "Office",
        "material": "Wool and Viscose",
        "origin": "Bhadohi, India",
        "pattern_style": "Abstract",
        "tags": ["Modern", "Office"],
        "featured": True,
        "new": True,
        "best": False,
    },
    {
        "category": "Woolen Rugs",
        "collection": "Varanasi",
        "title": "Indigo Courtyard Wool Rug",
        "price": 76000,
        "discount_price": 62900,
        "main_image": "/static/images/hero-3-26995d.jpg",
        "hover_image": "/static/images/Rug_Car/50/dsc-6014-042bcc.jpg",
        "size": "9x12 ft",
        "shape": "Rectangle",
        "space": "Living Room",
        "material": "Highland Wool",
        "origin": "Varanasi, India",
        "pattern_style": "Traditional",
        "tags": ["Traditional", "Living Room"],
        "featured": True,
        "new": False,
        "best": True,
    },
    {
        "category": "Vintage Kilims",
        "collection": "Mirzapur",
        "title": "Ochre Runner Kilim",
        "price": 28000,
        "discount_price": 22900,
        "main_image": "/static/images/Rug_Car/25/dsc-5790-f53492.jpg",
        "hover_image": "/static/images/Rug_Car/25/dsc-5791-14ce62.jpg",
        "size": "2.5x8 ft",
        "shape": "Runner",
        "space": "Hallway",
        "material": "Handspun Wool",
        "origin": "Mirzapur, India",
        "pattern_style": "Geometric",
        "tags": ["Runner", "Hallway"],
        "featured": False,
        "new": True,
        "best": False,
    },
    {
        "category": "Silk Carpets",
        "collection": "Kashmir",
        "title": "Pearl Round Silk Accent Rug",
        "price": 58000,
        "discount_price": 49900,
        "main_image": "/static/images/Rug_Car/35/dsc-5870-ab8210.jpg",
        "hover_image": "/static/images/Rug_Car/35/dsc-5871-07b3d8.jpg",
        "size": "6 ft round",
        "shape": "Round",
        "space": "Bedroom",
        "material": "Mulberry Silk",
        "origin": "Kashmir, India",
        "pattern_style": "Floral",
        "tags": ["Round", "Bedroom"],
        "featured": False,
        "new": True,
        "best": False,
    },
    {
        "category": "Modern Abstracts",
        "collection": "Bhadohi",
        "title": "Charcoal Minimal Square Rug",
        "price": 39000,
        "discount_price": 31900,
        "main_image": "/static/images/Rug_Car/29/dsc-5822-3da877.jpg",
        "hover_image": "/static/images/Rug_Car/29/dsc-5823-cca7e4.jpg",
        "size": "6x6 ft",
        "shape": "Square",
        "space": "Office",
        "material": "Wool and Cotton",
        "origin": "Bhadohi, India",
        "pattern_style": "Minimal",
        "tags": ["Minimal", "Office"],
        "featured": False,
        "new": False,
        "best": True,
    },
]


class Command(BaseCommand):
    help = "Seed a compact Kalakroti catalog. Use --if-empty for production-safe seeding."

    def add_arguments(self, parser):
        parser.add_argument("--if-empty", action="store_true", help="Only seed when no products exist.")

    def handle(self, *args, **options):
        if options["if_empty"] and Product.objects.exists():
            self.stdout.write(self.style.SUCCESS("Catalog already has products. Seed skipped."))
            return

        categories = {}
        for data in SAMPLE_CATEGORIES:
            category, _ = Category.objects.update_or_create(
                slug=data["slug"],
                defaults={"name": data["name"], "image_url": data["image_url"], "order": data["order"]},
            )
            categories[data["name"]] = category

        collections = {}
        for name in sorted({item["collection"] for item in SAMPLE_PRODUCTS}):
            collections[name], _ = Collection.objects.get_or_create(name=name)

        created = 0
        updated = 0
        for index, item in enumerate(SAMPLE_PRODUCTS, start=1):
            slug = slugify(item["title"])
            product, was_created = Product.objects.update_or_create(
                slug=slug,
                defaults={
                    "category": categories[item["category"]],
                    "collection": collections[item["collection"]],
                    "title": item["title"],
                    "short_description": f"{item['material']} crafted for {item['space'].lower()} spaces.",
                    "description": (
                        f"{item['title']} brings {item['origin']} craft into refined interiors with "
                        f"{item['pattern_style'].lower()} detailing and a {item['shape'].lower()} silhouette."
                    ),
                    "price": item["price"],
                    "discount_price": item["discount_price"],
                    "sku": f"KALA-{index:03d}",
                    "stock_quantity": 6,
                    "main_image": item["main_image"],
                    "hover_image": item["hover_image"],
                    "size": item["size"],
                    "shape": item["shape"],
                    "space": item["space"],
                    "material": item["material"],
                    "origin": item["origin"],
                    "pattern_style": item["pattern_style"],
                    "is_featured": item["featured"],
                    "is_new_arrival": item["new"],
                    "is_best_seller": item["best"],
                    "status": "published",
                },
            )
            tags = [Tag.objects.get_or_create(name=name)[0] for name in item["tags"]]
            product.tags.set(tags)
            ProductImage.objects.update_or_create(
                product=product,
                order=0,
                defaults={"image_url": item["main_image"], "alt_text": item["title"]},
            )
            created += int(was_created)
            updated += int(not was_created)

        self.stdout.write(self.style.SUCCESS(f"Catalog seed completed. Created {created}, updated {updated}."))
