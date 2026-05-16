#!/usr/bin/env bash
# exit on error
set -o errexit

# Install dependencies
pip install -r requirements.txt

# Collect static files
python manage.py collectstatic --no-input

# Run migrations
python manage.py migrate

# Optional production-safe sample catalog seed.
# Set SEED_SAMPLE_DATA=True in Render only when the target database is empty.
if [ "$SEED_SAMPLE_DATA" = "True" ]; then
  python manage.py seed_catalog --if-empty
fi
