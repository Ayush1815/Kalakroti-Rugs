import os
from pathlib import Path
from PIL import Image
from django.core.management import BaseCommand
from django.conf import settings
from django.db import transaction
from api.models import Product, ProductImage

class Command(BaseCommand):
    help = "Optimize catalog images by converting JPG/PNG to WebP format for next-gen performance."

    def add_arguments(self, parser):
        parser.add_argument("--quality", type=int, default=85, help="WebP compression quality (1-100).")
        parser.add_argument("--dry-run", action="store_true", help="Only show what would be done without modifying files.")

    def handle(self, *args, **options):
        quality = options["quality"]
        dry_run = options["dry_run"]
        base_dir = Path(settings.MEDIA_ROOT) / "Rug_Car"

        if not base_dir.exists():
            self.stdout.write(self.style.ERROR(f"Directory not found: {base_dir}"))
            return

        converted_count = 0
        total_savings = 0

        with transaction.atomic():
            for folder in base_dir.iterdir():
                if not folder.is_dir():
                    continue
                
                for img_path in folder.iterdir():
                    if img_path.suffix.lower() in [".jpg", ".jpeg", ".png"]:
                        webp_path = img_path.with_suffix(".webp")
                        
                        # Skip if webp already exists
                        if webp_path.exists():
                            continue
                            
                        if not dry_run:
                            try:
                                # Process Image
                                with Image.open(img_path) as img:
                                    # Convert RGBA to RGB for JPEG origin files saving as WebP
                                    if img.mode in ("RGBA", "P"):
                                        img = img.convert("RGB")
                                    
                                    orig_size = img_path.stat().st_size
                                    img.save(webp_path, "webp", quality=quality)
                                    new_size = webp_path.stat().st_size
                                    
                                    savings = orig_size - new_size
                                    if savings > 0:
                                        total_savings += savings
                                        
                                    # Update Database References safely
                                    # Format: /images/Rug_Car/09/image.jpg
                                    old_url = f"/images/Rug_Car/{folder.name}/{img_path.name}"
                                    new_url = f"/images/Rug_Car/{folder.name}/{webp_path.name}"
                                    
                                    Product.objects.filter(main_image=old_url).update(main_image=new_url)
                                    Product.objects.filter(hover_image=old_url).update(hover_image=new_url)
                                    ProductImage.objects.filter(image_url=old_url).update(image_url=new_url)

                                    # Clean up old file to save space
                                    img_path.unlink()
                                    converted_count += 1
                                    self.stdout.write(self.style.SUCCESS(f"Optimized: {img_path.name} -> .webp"))

                            except Exception as e:
                                self.stdout.write(self.style.ERROR(f"Failed converting {img_path.name}: {str(e)}"))
                        else:
                            self.stdout.write(f"[Dry Run] Would convert {img_path.name} to WebP.")

        mb_saved = total_savings / (1024 * 1024)
        if dry_run:
            self.stdout.write(self.style.SUCCESS("Dry run completed."))
        else:
            self.stdout.write(self.style.SUCCESS(f"Optimization complete. Converted {converted_count} images."))
            self.stdout.write(self.style.SUCCESS(f"Estimated bandwidth saved per full load: {mb_saved:.2f} MB."))
