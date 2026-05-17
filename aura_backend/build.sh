#!/usr/bin/env bash
# exit on error
set -o errexit

# Install dependencies
pip install -r requirements.txt

# Collect static files
python manage.py collectstatic --no-input

# Run migrations
python manage.py migrate

# Run production-safe sample catalog seed.
# Safe check inside seed_catalog --if-empty ensures it only seeds when the database is empty.
python manage.py seed_catalog --if-empty
