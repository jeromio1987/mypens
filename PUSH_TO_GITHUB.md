# Push MY PENS projects to GitHub

You have two repos to push:

| Folder | What it is | GitHub repo name |
|--------|-----------|-----------------|
| `my-pens` | Roadmap, docs, strategy | `my-pens` |
| `my-pens-app` | The actual app (Next.js) | `my-pens-app` |

---

## Step 1 — Create both repos on GitHub

Go to https://github.com/new and create **two** repos:

**Repo 1:**
- Name: `my-pens`
- Description: `Roadmap and strategy for MY PENS`
- Public ✓ | Do NOT initialize with README

**Repo 2:**
- Name: `my-pens-app`
- Description: `MY PENS — the trusted interpretation layer between raw trackers and everyday users`
- Public ✓ | Do NOT initialize with README

---

## Step 2 — Open your terminal

Find where these folders live on your computer (wherever Claude saved them), then run the blocks below.

---

### Repo 1 — my-pens (roadmap)

```bash
cd path/to/my-pens

git init -b main
git add .
git commit -m "Initial commit — roadmap, docs, project structure"
git remote add origin https://github.com/YOUR_USERNAME/my-pens.git
git push -u origin main
```

---

### Repo 2 — my-pens-app (the app)

```bash
cd path/to/my-pens-app

git init -b main
git add .
git commit -m "Initial commit — Next.js app foundation"
git remote add origin https://github.com/YOUR_USERNAME/my-pens-app.git
git push -u origin main
```

---

**Replace** `path/to/` with the actual location on your computer, and `YOUR_USERNAME` with your GitHub username.

Done. Both repos live at:
- `https://github.com/YOUR_USERNAME/my-pens`
- `https://github.com/YOUR_USERNAME/my-pens-app`
