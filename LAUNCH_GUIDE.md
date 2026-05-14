# 🚀 Launch Guide: Kalakroti Rugs E-Commerce

Follow these steps to get the **Kalakroti Rugs** platform up and running on your local machine.

## 📋 Prerequisites
- **Python 3.11+** installed.
- **Node.js** (Optional, only if using live reload extensions).
- **VS Code** (Recommended).

---

## 🛠️ Step 1: Backend Setup (Django)

1. **Open your Terminal** in the project root: `d:\Placement\Rugs and Antiques - Copy`.
2. **Navigate to the backend directory**:
   ```powershell
   cd aura_backend
   ```
3. **Create a Virtual Environment** (if not already present):
   ```powershell
   python -m venv .venv
   ```
4. **Activate the Virtual Environment**:
   ```powershell
   .venv\Scripts\Activate
   ```
5. **Install Dependencies**:
   ```powershell
   pip install -r requirements.txt
   ```

---

## 🗄️ Step 2: Database Initialization

1. **Run Migrations** to create the schema:
   ```powershell
   python manage.py migrate
   ```
2. **Seed the Masterpieces** (Populates categories and rugs):
   ```powershell
   python seed.py
   ```
3. **Create Admin User** (To access the Django Dashboard):
   ```powershell
   python manage.py createsuperuser
   ```

---

## 🏺 Step 3: Launching the Platform

1. **Start the Django Server**:
   ```powershell
   python manage.py runserver
   ```
2. **Access the Experience**:
   - **Frontend**: [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
   - **Admin Dashboard**: [http://127.0.0.1:8000/admin/](http://127.0.0.1:8000/admin/)
   - **Curation Console**: [http://127.0.0.1:8000/admin.html](http://127.0.0.1:8000/admin.html)

---

## 💡 Troubleshooting & Tips
- **Port Conflict**: If port `8000` is in use, run `python manage.py runserver 8001`.
- **Image 404s**: Ensure you are running the server from the `aura_backend` directory so the `/images/` root is correctly mapped.
- **SPA Routing**: The frontend uses a custom JS router. If you refresh on a sub-page (e.g., `/all`) and get a 404, ensure the server is running; Django is configured to serve `index.html` for all non-API routes.

---
**Kalakroti Rugs** | *Heritage in every thread.*

