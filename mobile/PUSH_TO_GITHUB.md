# 🚀 Push Your Mobile App to GitHub (PC)

## Quick Commands

```powershell
# Navigate to mobile folder
cd C:\Users\kenny\treasure-hunt-sdk\mobile

# Initialize Git repository
git init

# Add all files
git add .

# Create first commit
git commit -m "Initial React Native mobile app for iOS and Android"
```

Now create the repository on GitHub, then:

```powershell
# Add GitHub as remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/treasure-hunt-mobile.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step-by-Step

### 1. Create GitHub Repository

**Go to:** https://github.com/new

**Fill in:**
- Repository name: `treasure-hunt-mobile`
- Description: `React Native app for iOS and Android - Treasure Hunt SDK`
- **Private** (recommended for now)
- **Don't** check "Initialize with README" (you already have files)
- Click **"Create repository"**

### 2. Copy the Commands

GitHub will show you commands like:
```
git remote add origin https://github.com/YOUR_USERNAME/treasure-hunt-mobile.git
git branch -M main
git push -u origin main
```

Copy YOUR specific commands (with your actual username).

### 3. Run Commands in PowerShell

```powershell
cd C:\Users\kenny\treasure-hunt-sdk\mobile

# Paste the commands from GitHub
git remote add origin https://github.com/YOUR_USERNAME/treasure-hunt-mobile.git
git branch -M main
git push -u origin main
```

**Enter your GitHub credentials if prompted.**

### 4. Verify Upload

Go to: `https://github.com/YOUR_USERNAME/treasure-hunt-mobile`

You should see:
- ✅ `src/` folder with all screens
- ✅ `ios/` folder with Xcode project
- ✅ `android/` folder with Android project
- ✅ `package.json`
- ✅ `README.md`

**Should NOT see:**
- ❌ `node_modules/` (excluded by .gitignore)
- ❌ `google-services.json` (excluded by .gitignore)
- ❌ `GoogleService-Info.plist` (excluded by .gitignore)

Perfect! ✅

---

## Making Future Changes

### After editing code:

```powershell
# See what changed
git status

# Add all changes
git add .

# Commit with message
git commit -m "Added new feature"

# Push to GitHub
git push
```

---

## Pulling Changes on Mac

When someone makes changes on Mac:

```bash
# On Mac
cd ~/Documents/treasure-hunt-mobile
git pull
```

---

## Common Git Commands

```powershell
# Check status
git status

# See what changed
git diff

# View commit history
git log --oneline

# Create new branch for feature
git checkout -b new-feature

# Switch back to main
git checkout main

# Undo changes (be careful!)
git checkout -- filename.tsx
```

---

## Troubleshooting

### "fatal: not a git repository"
```powershell
git init
```

### "Please tell me who you are"
```powershell
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### "Authentication failed"
- Use GitHub personal access token instead of password
- Generate at: https://github.com/settings/tokens
- Or use GitHub Desktop app (easier)

### "rejected: failed to push"
```powershell
# Pull first, then push
git pull origin main --rebase
git push
```

---

## Alternative: GitHub Desktop (Easier)

If you prefer a GUI:

1. Download **GitHub Desktop**: https://desktop.github.com/
2. Install and sign in
3. File → Add Local Repository
4. Select `C:\Users\kenny\treasure-hunt-sdk\mobile`
5. Publish repository to GitHub
6. All Git commands now have buttons!

**Benefits:**
- Visual diff viewer
- Easy commit/push buttons
- Branch management
- No command line needed

---

## What Happens Next?

Once on GitHub:

1. ✅ **Anyone with a Mac** can clone and build iOS version
2. ✅ **Code is backed up** safely on GitHub
3. ✅ **Version control** - can revert changes
4. ✅ **Collaboration** - multiple people can contribute
5. ✅ **CI/CD** - can set up automatic builds

---

## Ready to Push?

Run these commands:

```powershell
cd C:\Users\kenny\treasure-hunt-sdk\mobile
git init
git add .
git commit -m "Initial mobile app commit"
```

Then create repo on GitHub and push! 🚀
