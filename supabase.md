# Supabase Production Setup

This project uses Django models and migrations as the source of truth. Supabase is the managed PostgreSQL host; do not hand-edit tables in Supabase unless you are also creating matching Django migrations.

## 1. Create The Supabase Project

1. Create a new Supabase project.
2. Open **Project Settings > Database**.
3. Copy the PostgreSQL connection string in URI format.
4. Use the direct connection URI for migrations and backend runtime unless you explicitly configure a pooler for your deployment.

Example:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_ID.supabase.co:5432/postgres
```

## 2. Required Environment Variables

Set these in Render or your production host:

```env
SECRET_KEY=generate-a-long-random-django-secret
DEBUG=False
ALLOWED_HOSTS=kalakroti-rugs.onrender.com,your-custom-domain.com
SITE_URL=https://kalakroti-rugs.onrender.com
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_ID.supabase.co:5432/postgres
CORS_ALLOWED_ORIGINS=https://kalakroti-rugs.onrender.com,https://your-custom-domain.com
GOOGLE_CLIENT_ID=YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com
RAZORPAY_KEY_ID=rzp_live_or_test_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
SEED_SAMPLE_DATA=False
```

Use `SEED_SAMPLE_DATA=True` only for the first deploy if the product table is empty and you want the bundled sample catalog inserted automatically.

## 3. Google Sign-In Setup

1. In Google Cloud Console, create or open a project.
2. Configure **OAuth consent screen**.
3. Create an **OAuth Client ID** with application type **Web application**.
4. Add authorized JavaScript origins:

```text
https://kalakroti-rugs.onrender.com
https://your-custom-domain.com
http://localhost:8000
```

5. Copy the client ID into `GOOGLE_CLIENT_ID`.

The browser receives a Google Identity Services ID token. Django verifies that token server-side against `GOOGLE_CLIENT_ID` before creating the local Kalakroti session.

## 4. Apply Schema To Supabase

From the `aura_backend` directory:

```powershell
uv run --with-requirements requirements.txt python manage.py migrate
```

On Render, the existing `build.sh` already runs:

```bash
python manage.py collectstatic --no-input
python manage.py migrate
```

The schema includes:

- Catalog: categories, collections, tags, products, variants, product images, reviews
- Commerce: coupons, orders, order items
- Accounts: Django users plus customer profiles
- Saved data: carts, cart items, wishlists, wishlist items
- Dashboard data: addresses, payment method references, notifications, support tickets

## 5. Seed Products Safely

To seed only when the database has no products:

```powershell
uv run --with-requirements requirements.txt python manage.py seed_catalog --if-empty
```

Render option:

1. Set `SEED_SAMPLE_DATA=True`.
2. Redeploy once.
3. After products appear, set `SEED_SAMPLE_DATA=False`.

Do not run `seed.py` directly on a production database that already has real products. It rebuilds the sample catalog.

## 6. Verify Production

After deploy, test:

```text
https://kalakroti-rugs.onrender.com/api/products/?page_size=3
https://kalakroti-rugs.onrender.com/api/categories/
https://kalakroti-rugs.onrender.com/all
https://kalakroti-rugs.onrender.com/dashboard.html
```

Expected results:

- `/api/products/` returns product JSON, not `[]`.
- `/all` displays product cards and filters.
- Homepage Top Picks displays up to 8 featured products.
- Google sign-in shows the real Google button when `GOOGLE_CLIENT_ID` is set.
- Cart and wishlist open as right-side drawers, not full-page panels.

## 7. Migration Discipline

When schema changes are needed:

```powershell
uv run --with-requirements requirements.txt python manage.py makemigrations
uv run --with-requirements requirements.txt python manage.py migrate
uv run --with-requirements requirements.txt python manage.py test api
```

Commit the generated migration files. Supabase should receive schema changes only through Django migrations.

