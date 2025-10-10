# Git Setup Guide for Django React LMS

This guide will walk you through setting up Git version control for your Django React LMS project and connecting it to GitHub.

## 📋 Table of Contents

1. [Install Git](#1-install-git)
2. [Configure Git](#2-configure-git)
3. [Initialize Repository](#3-initialize-repository)
4. [Create Initial Commit](#4-create-initial-commit)
5. [Setup GitHub](#5-setup-github)
6. [Push to GitHub](#6-push-to-github)
7. [Git Workflow](#7-git-workflow)
8. [Common Commands](#8-common-commands)
9. [Best Practices](#9-best-practices)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Install Git

### Windows

**Step 1:** Download Git for Windows
- Visit: https://git-scm.com/download/win
- Download will start automatically (64-bit version recommended)

**Step 2:** Run Installer
- Double-click the downloaded `.exe` file
- Follow installation wizard with these **RECOMMENDED SETTINGS**:

#### Installation Settings:
1. **Select Components** (keep defaults):
   - ✅ Windows Explorer integration
   - ✅ Git Bash Here
   - ✅ Git GUI Here
   - ✅ Associate .git* configuration files with the default text editor

2. **Choosing the default editor** (pick one):
   - Recommended: **Visual Studio Code** (if installed)
   - Alternative: Vim, Notepad++, etc.

3. **Adjusting your PATH environment**:
   - Select: **"Git from the command line and also from 3rd-party software"** ✅ (RECOMMENDED)

4. **Choosing HTTPS transport backend**:
   - Select: **"Use the OpenSSL library"** ✅ (RECOMMENDED)

5. **Configuring line ending conversions**:
   - Select: **"Checkout Windows-style, commit Unix-style line endings"** ✅ (RECOMMENDED)

6. **Configuring the terminal emulator**:
   - Select: **"Use MinTTY"** ✅ (RECOMMENDED)

7. **Extra options**:
   - ✅ Enable file system caching
   - ✅ Enable Git Credential Manager

8. Click **Install**

**Step 3:** Verify Installation
Open PowerShell or Command Prompt and run:
```powershell
git --version
```

You should see output like: `git version 2.43.0.windows.1`

### macOS

```bash
# Option 1: Using Homebrew (recommended)
brew install git

# Option 2: Using Xcode Command Line Tools
xcode-select --install
```

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install git
```

---

## 2. Configure Git

After installing Git, configure your identity (this will be associated with your commits):

```bash
# Set your name
git config --global user.name "Your Name"

# Set your email (use your GitHub email)
git config --global user.email "your.email@example.com"

# Optional: Set default branch name to 'main'
git config --global init.defaultBranch main

# Optional: Enable color UI
git config --global color.ui auto

# Verify your configuration
git config --list
```

---

## 3. Initialize Repository

**Step 1:** Navigate to your project directory:
```bash
cd "C:\Users\MSI_\OneDrive\Desktop\Lessons\Django React LMS"
```

**Step 2:** Initialize Git repository:
```bash
git init
```

You should see: `Initialized empty Git repository in ...`

**Step 3:** Verify .gitignore files exist:
- Root: `.gitignore`
- Backend: `backend/.gitignore`
- Frontend: `frontend/.gitignore`

These files are already created and will prevent unnecessary files from being tracked.

---

## 4. Create Initial Commit

**Step 1:** Check status:
```bash
git status
```

This shows all untracked files. You should see your project files but NOT:
- `node_modules/`
- `venv/` or `env/`
- `db.sqlite3`
- `__pycache__/`
- `.env` files

**Step 2:** Stage all files:
```bash
git add .
```

**Step 3:** Review what will be committed:
```bash
git status
```

All files should now be in "Changes to be committed" (green).

**Step 4:** Create initial commit:
```bash
git commit -m "Initial commit: Clean Django React LMS project

- Complete Learning Management System
- Django REST Framework backend
- React + Vite frontend
- Professional trial reports included
- Production-ready codebase"
```

**Step 5:** Verify commit:
```bash
git log --oneline
```

You should see your commit with a unique hash.

---

## 5. Setup GitHub

### Create GitHub Account (if you don't have one)
1. Visit: https://github.com
2. Click **Sign up**
3. Follow registration process
4. Verify your email

### Create New Repository

**Step 1:** Log in to GitHub

**Step 2:** Click the "+" icon (top right) → **New repository**

**Step 3:** Fill in repository details:
- **Repository name**: `django-react-lms` (or your preferred name)
- **Description**: "Learning Management System built with Django REST Framework and React"
- **Visibility**: 
  - **Private** (recommended for internal projects)
  - **Public** (if open-source)
- **DO NOT** initialize with:
  - ❌ README
  - ❌ .gitignore
  - ❌ license
  
  (We already have these locally)

**Step 4:** Click **Create repository**

**Step 5:** Copy the repository URL:
- For HTTPS: `https://github.com/yourusername/django-react-lms.git`
- For SSH: `git@github.com:yourusername/django-react-lms.git`

---

## 6. Push to GitHub

**Step 1:** Add remote repository:
```bash
# Replace with your GitHub repository URL
git remote add origin https://github.com/yourusername/django-react-lms.git
```

**Step 2:** Verify remote:
```bash
git remote -v
```

You should see:
```
origin  https://github.com/yourusername/django-react-lms.git (fetch)
origin  https://github.com/yourusername/django-react-lms.git (push)
```

**Step 3:** Rename branch to 'main' (if needed):
```bash
git branch -M main
```

**Step 4:** Push to GitHub:
```bash
git push -u origin main
```

**Step 5:** Enter GitHub credentials when prompted:
- **Username**: Your GitHub username
- **Password**: Your GitHub **Personal Access Token** (NOT your password)

### How to create Personal Access Token:
1. GitHub → Settings (top right avatar)
2. Developer settings (bottom left)
3. Personal access tokens → Tokens (classic)
4. Generate new token (classic)
5. Give it a name: "LMS Project"
6. Select scopes: ✅ **repo** (full control)
7. Generate token
8. **COPY TOKEN** (you won't see it again!)
9. Use this token as your password

**Step 6:** Verify on GitHub:
- Refresh your GitHub repository page
- You should see all your files

---

## 7. Git Workflow

### Daily Development Workflow

```bash
# 1. Check current status
git status

# 2. See what changed
git diff

# 3. Stage specific files
git add backend/api/views.py
git add frontend/src/components/Course.jsx

# OR stage all changes
git add .

# 4. Commit with descriptive message
git commit -m "Add course filtering feature"

# 5. Push to GitHub
git push origin main
```

### Feature Branch Workflow (Recommended for Teams)

```bash
# 1. Create and switch to new branch
git checkout -b feature/quiz-timer

# 2. Make changes and commit
git add .
git commit -m "Implement quiz timer functionality"

# 3. Push feature branch
git push -u origin feature/quiz-timer

# 4. Create Pull Request on GitHub
# (Go to GitHub web interface)

# 5. After PR is merged, switch back and update
git checkout main
git pull origin main

# 6. Delete local feature branch
git branch -d feature/quiz-timer
```

### Branch Strategy

```
main (production-ready code)
│
├── develop (integration branch)
│   │
│   ├── feature/user-profile
│   ├── feature/quiz-timer
│   └── feature/video-compression
│
└── hotfix/urgent-bug-fix
```

---

## 8. Common Commands

### Checking Status
```bash
# See what changed
git status

# See detailed changes
git diff

# See commit history
git log --oneline --graph --all
```

### Staging & Committing
```bash
# Stage specific file
git add filename.py

# Stage all changes
git add .

# Unstage file
git restore --staged filename.py

# Commit
git commit -m "Descriptive message"

# Amend last commit (if you forgot something)
git commit --amend
```

### Branching
```bash
# List branches
git branch

# Create new branch
git branch feature-name

# Switch to branch
git checkout feature-name

# Create and switch in one command
git checkout -b feature-name

# Delete branch
git branch -d feature-name
```

### Remote Operations
```bash
# See remote repositories
git remote -v

# Fetch updates from remote
git fetch origin

# Pull updates (fetch + merge)
git pull origin main

# Push to remote
git push origin main

# Push new branch
git push -u origin feature-name
```

### Undoing Changes
```bash
# Discard changes in working directory
git restore filename.py

# Unstage file (keep changes)
git restore --staged filename.py

# Revert commit (creates new commit)
git revert <commit-hash>

# Reset to previous commit (CAREFUL!)
git reset --hard HEAD~1
```

---

## 9. Best Practices

### Commit Messages
✅ **Good:**
```
Add user authentication endpoint

- Implement JWT token generation
- Add login/logout views
- Create user serializer
```

❌ **Bad:**
```
fixed stuff
update
changes
```

### Commit Guidelines:
1. Use present tense: "Add feature" not "Added feature"
2. Be descriptive but concise
3. Explain **what** and **why**, not **how**
4. One commit = one logical change

### Files to NEVER Commit:
- ❌ `.env` files (secrets, API keys)
- ❌ `db.sqlite3` (development database)
- ❌ `node_modules/` (dependencies)
- ❌ `venv/`, `env/` (virtual environments)
- ❌ `__pycache__/`, `*.pyc` (Python cache)
- ❌ Large media files (videos, large PDFs)
- ❌ IDE settings (`.vscode/`, `.idea/`)
- ❌ Build outputs (`dist/`, `build/`)

✅ Already handled by `.gitignore` files!

### When to Commit:
- ✅ After completing a feature
- ✅ After fixing a bug
- ✅ Before switching tasks
- ✅ At end of work session
- ✅ Before merging branches

### Branch Naming:
- `feature/description` - New features
- `bugfix/description` - Bug fixes
- `hotfix/description` - Urgent production fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates

---

## 10. Troubleshooting

### Problem: "fatal: not a git repository"
**Solution:** You're not in a Git repository. Navigate to project root and run `git init`.

### Problem: "Permission denied (publickey)"
**Solution:** 
1. Use HTTPS instead of SSH, or
2. Setup SSH key: https://docs.github.com/en/authentication/connecting-to-github-with-ssh

### Problem: "failed to push some refs"
**Solution:**
```bash
# Pull first, then push
git pull origin main --rebase
git push origin main
```

### Problem: Accidentally committed sensitive files
**Solution:**
```bash
# Remove from Git but keep locally
git rm --cached .env
git commit -m "Remove .env from tracking"
git push origin main

# Add to .gitignore
echo ".env" >> .gitignore
```

### Problem: Want to undo last commit (not pushed yet)
**Solution:**
```bash
# Keep changes, undo commit
git reset --soft HEAD~1

# Discard changes completely
git reset --hard HEAD~1
```

### Problem: Merge conflicts
**Solution:**
```bash
# 1. See conflicted files
git status

# 2. Open files and resolve conflicts (look for <<<<<<, ======, >>>>>>)

# 3. Stage resolved files
git add resolved-file.py

# 4. Complete merge
git commit
```

---

## 🎉 Congratulations!

Your Django React LMS project is now under version control with Git and GitHub!

### Next Steps:
1. ✅ Make regular commits
2. ✅ Push to GitHub frequently
3. ✅ Use feature branches for new features
4. ✅ Write descriptive commit messages
5. ✅ Never commit secrets or large files
6. ✅ Collaborate with your team via Pull Requests

### Quick Reference:
```bash
# Daily workflow
git status              # Check what changed
git add .               # Stage changes
git commit -m "msg"     # Commit
git push origin main    # Push to GitHub
git pull origin main    # Get updates
```

---

## 📚 Resources

- [Git Official Documentation](https://git-scm.com/doc)
- [GitHub Guides](https://guides.github.com)
- [Git Cheat Sheet](https://education.github.com/git-cheat-sheet-education.pdf)
- [Atlassian Git Tutorials](https://www.atlassian.com/git/tutorials)
- [Pro Git Book (Free)](https://git-scm.com/book/en/v2)

---

**Questions?** Open an issue on GitHub or contact the development team.

**Happy coding! 🚀**
