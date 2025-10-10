# Git Workflow & Best Practices for Django React LMS

This document outlines the Git workflow, branching strategy, and best practices for the Django React LMS project.

## 📋 Table of Contents

1. [Branch Strategy](#branch-strategy)
2. [Workflow for Solo Development](#workflow-for-solo-development)
3. [Workflow for Team Development](#workflow-for-team-development)
4. [Commit Message Guidelines](#commit-message-guidelines)
5. [Code Review Process](#code-review-process)
6. [Release Process](#release-process)
7. [Hotfix Process](#hotfix-process)
8. [Best Practices](#best-practices)

---

## Branch Strategy

### Branch Types

```
main (production)
├── develop (integration)
│   ├── feature/user-authentication
│   ├── feature/video-upload
│   ├── feature/quiz-system
│   ├── bugfix/login-validation
│   └── refactor/api-optimization
└── hotfix/security-patch
```

### Branch Naming Convention

| Type | Pattern | Example | Purpose |
|------|---------|---------|---------|
| **Feature** | `feature/description` | `feature/course-filtering` | New features |
| **Bugfix** | `bugfix/description` | `bugfix/video-playback` | Bug fixes |
| **Hotfix** | `hotfix/description` | `hotfix/security-patch` | Urgent production fixes |
| **Refactor** | `refactor/description` | `refactor/database-queries` | Code improvements |
| **Docs** | `docs/description` | `docs/api-documentation` | Documentation updates |
| **Test** | `test/description` | `test/quiz-integration` | Testing additions |

### Branch Descriptions

#### 1. `main` Branch
- **Purpose**: Production-ready code
- **Protection**: Protected, no direct commits
- **Merges from**: `develop` (releases), `hotfix` (emergency fixes)
- **Deploy to**: Production server
- **Status**: Always stable and deployable

#### 2. `develop` Branch
- **Purpose**: Integration branch for features
- **Protection**: Protected, no direct commits (except small fixes)
- **Merges from**: `feature/*`, `bugfix/*`, `refactor/*`
- **Merges to**: `main` (releases)
- **Deploy to**: Staging server
- **Status**: Latest development, may be unstable

#### 3. `feature/*` Branches
- **Purpose**: Develop new features
- **Created from**: `develop`
- **Merges to**: `develop` (via Pull Request)
- **Lifetime**: Temporary (delete after merge)
- **Examples**:
  - `feature/user-profile`
  - `feature/payment-integration`
  - `feature/email-notifications`

#### 4. `bugfix/*` Branches
- **Purpose**: Fix non-critical bugs
- **Created from**: `develop`
- **Merges to**: `develop` (via Pull Request)
- **Lifetime**: Temporary (delete after merge)
- **Examples**:
  - `bugfix/video-loading`
  - `bugfix/form-validation`

#### 5. `hotfix/*` Branches
- **Purpose**: Urgent production fixes
- **Created from**: `main`
- **Merges to**: `main` AND `develop`
- **Lifetime**: Temporary (delete after merge)
- **Examples**:
  - `hotfix/security-vulnerability`
  - `hotfix/critical-crash`

---

## Workflow for Solo Development

### Simple Workflow (Single Developer)

```bash
# 1. Start with main branch
git checkout main
git pull origin main

# 2. Create feature branch
git checkout -b feature/quiz-timer

# 3. Make changes
# ... edit files ...

# 4. Commit changes
git add .
git commit -m "Add quiz timer functionality"

# 5. Push to GitHub
git push -u origin feature/quiz-timer

# 6. Merge to main (locally or via GitHub PR)
git checkout main
git merge feature/quiz-timer

# 7. Push to GitHub
git push origin main

# 8. Delete feature branch
git branch -d feature/quiz-timer
git push origin --delete feature/quiz-timer
```

### Daily Work Pattern

```bash
# Morning: Start work session
git checkout main
git pull origin main
git checkout -b feature/my-feature

# During day: Regular commits
git add .
git commit -m "Implement X"
git push origin feature/my-feature

# End of day: Merge and cleanup
git checkout main
git merge feature/my-feature
git push origin main
git branch -d feature/my-feature
```

---

## Workflow for Team Development

### Git Flow (Recommended for Teams)

#### 1. Setup (One-time)

```bash
# Clone repository
git clone <repository-url>
cd django-react-lms

# Create develop branch (if not exists)
git checkout -b develop
git push -u origin develop

# Set develop as default branch for new features
git checkout develop
```

#### 2. Feature Development

```bash
# 1. Update develop branch
git checkout develop
git pull origin develop

# 2. Create feature branch
git checkout -b feature/course-filtering

# 3. Make changes and commit regularly
git add .
git commit -m "Add course filter by category"
git push -u origin feature/course-filtering

# 4. Continue working
# ... make more changes ...
git add .
git commit -m "Add filter by price range"
git push origin feature/course-filtering

# 5. Create Pull Request on GitHub
# Go to GitHub → Pull Requests → New Pull Request
# Base: develop ← Compare: feature/course-filtering

# 6. After PR is approved and merged
git checkout develop
git pull origin develop

# 7. Delete local feature branch
git branch -d feature/course-filtering
```

#### 3. Release Process

```bash
# 1. Create release branch from develop
git checkout develop
git pull origin develop
git checkout -b release/v1.0.0

# 2. Bump version numbers, update changelog
# ... make version changes ...
git add .
git commit -m "Bump version to 1.0.0"

# 3. Test thoroughly on release branch

# 4. Merge to main
git checkout main
git merge release/v1.0.0
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin main --tags

# 5. Merge back to develop
git checkout develop
git merge release/v1.0.0
git push origin develop

# 6. Delete release branch
git branch -d release/v1.0.0
```

---

## Commit Message Guidelines

### Format

```
<type>: <subject>

<body>

<footer>
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style (formatting, missing semicolons, etc.)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Adding tests
- **chore**: Maintenance tasks (dependencies, build, etc.)
- **revert**: Revert previous commit

### Examples

#### Good Commit Messages ✅

```
feat: Add course filtering by category

- Implement filter dropdown in CourseList component
- Add category filter API endpoint
- Update course serializer to include category

Closes #42
```

```
fix: Resolve video playback issue on mobile

The video player was not initializing properly on iOS devices
due to autoplay restrictions. Added user gesture requirement.

Fixes #128
```

```
refactor: Optimize database queries in course API

- Replace N+1 queries with select_related
- Add prefetch_related for related models
- Improve response time from 500ms to 80ms

Performance improvement of 84%
```

#### Bad Commit Messages ❌

```
fixed stuff
```

```
update
```

```
changes to video player
```

```
WIP
```

### Rules

1. **Use present tense**: "Add feature" not "Added feature"
2. **Capitalize first letter**: "Fix bug" not "fix bug"
3. **No period at end**: "Add feature" not "Add feature."
4. **Limit subject line to 50 characters**
5. **Wrap body at 72 characters**
6. **Separate subject from body with blank line**
7. **Use body to explain what and why, not how**
8. **Reference issues**: Use "Closes #123" or "Fixes #456"

---

## Code Review Process

### Before Creating Pull Request

1. ✅ **Self-review your code**
2. ✅ **Run all tests**: `npm test` and `python manage.py test`
3. ✅ **Check for console.logs** (should be removed)
4. ✅ **Ensure code follows style guide**
5. ✅ **Update documentation** if needed
6. ✅ **Rebase on latest develop**: `git rebase develop`
7. ✅ **Resolve conflicts** if any

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How has this been tested?

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No console.log statements
- [ ] Tests pass locally
- [ ] No merge conflicts
```

### Review Checklist

**Code Quality**
- [ ] Code is readable and maintainable
- [ ] No unnecessary complexity
- [ ] Follows DRY principle
- [ ] Proper error handling

**Security**
- [ ] No hardcoded secrets
- [ ] Input validation present
- [ ] SQL injection protected
- [ ] XSS protection implemented

**Performance**
- [ ] No N+1 queries
- [ ] Efficient algorithms used
- [ ] No memory leaks
- [ ] Proper caching

**Testing**
- [ ] Tests included
- [ ] Edge cases covered
- [ ] Tests pass

---

## Release Process

### Version Numbering (Semantic Versioning)

```
MAJOR.MINOR.PATCH (e.g., 1.2.3)
```

- **MAJOR**: Breaking changes (1.0.0 → 2.0.0)
- **MINOR**: New features, backwards compatible (1.0.0 → 1.1.0)
- **PATCH**: Bug fixes (1.0.0 → 1.0.1)

### Release Steps

1. **Plan Release**
   - Review completed features
   - Check all PRs merged to develop
   - Update CHANGELOG.md

2. **Create Release Branch**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b release/v1.0.0
   ```

3. **Prepare Release**
   - Bump version in `package.json`
   - Update version in Django settings
   - Update CHANGELOG.md
   - Run full test suite
   - Build and test production build

4. **Merge to Main**
   ```bash
   git checkout main
   git merge release/v1.0.0
   git tag -a v1.0.0 -m "Release 1.0.0"
   git push origin main --tags
   ```

5. **Merge Back to Develop**
   ```bash
   git checkout develop
   git merge release/v1.0.0
   git push origin develop
   ```

6. **Deploy to Production**
   - Deploy main branch to production
   - Monitor for issues
   - Create GitHub Release with notes

---

## Hotfix Process

For critical production bugs that need immediate fix:

```bash
# 1. Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-bug

# 2. Fix the bug
# ... make changes ...
git add .
git commit -m "hotfix: Fix critical bug in payment"

# 3. Test thoroughly
# Run tests, manual testing

# 4. Merge to main
git checkout main
git merge hotfix/critical-bug
git tag -a v1.0.1 -m "Hotfix 1.0.1"
git push origin main --tags

# 5. Merge to develop
git checkout develop
git merge hotfix/critical-bug
git push origin develop

# 6. Delete hotfix branch
git branch -d hotfix/critical-bug

# 7. Deploy to production immediately
```

---

## Best Practices

### Do's ✅

1. **Commit Often**
   - Small, logical commits
   - Easier to revert if needed
   - Better history tracking

2. **Write Descriptive Messages**
   - Explain what and why
   - Future you will thank you

3. **Pull Before Push**
   ```bash
   git pull origin main
   git push origin main
   ```

4. **Review Your Changes**
   ```bash
   git diff
   git status
   ```

5. **Use Branches**
   - Keep main clean
   - Isolate features
   - Easy to discard if needed

6. **Test Before Committing**
   - Run tests
   - Check build
   - Manual testing

7. **Keep Commits Atomic**
   - One logical change per commit
   - Related changes together

8. **Sync Regularly**
   ```bash
   git pull origin develop
   ```

### Don'ts ❌

1. **Never Commit Secrets**
   - No `.env` files
   - No API keys
   - No passwords
   - Use `.gitignore`

2. **Don't Commit Large Files**
   - Videos, large datasets
   - Use Git LFS if needed
   - Store externally (S3, etc.)

3. **Don't Commit Generated Files**
   - `node_modules/`
   - `dist/`, `build/`
   - `__pycache__/`
   - Handled by `.gitignore`

4. **Don't Commit Directly to Main**
   - Use feature branches
   - Use Pull Requests
   - Protect main branch

5. **Don't Force Push**
   ```bash
   # DANGEROUS!
   git push --force origin main
   ```
   - Only use in feature branches
   - Never on shared branches

6. **Don't Commit Commented Code**
   - Delete unused code
   - Git history keeps old versions

7. **Don't Mix Unrelated Changes**
   - One feature per commit
   - Separate bug fixes

---

## Common Scenarios

### Scenario 1: Made changes to wrong branch

```bash
# Save changes without committing
git stash

# Switch to correct branch
git checkout correct-branch

# Apply saved changes
git stash pop
```

### Scenario 2: Need to update feature branch with latest develop

```bash
# While on feature branch
git fetch origin
git rebase origin/develop

# Or use merge
git merge origin/develop
```

### Scenario 3: Made a mistake in last commit (not pushed)

```bash
# Fix the files
# ... make corrections ...

# Amend last commit
git add .
git commit --amend

# Update commit message if needed
git commit --amend -m "New message"
```

### Scenario 4: Need to undo last commit (not pushed)

```bash
# Keep changes in working directory
git reset --soft HEAD~1

# Discard changes completely
git reset --hard HEAD~1
```

### Scenario 5: Accidentally committed to main

```bash
# Move commit to new branch
git branch feature/my-feature
git reset --hard HEAD~1
git checkout feature/my-feature
```

---

## Git Aliases (Optional Productivity Boost)

Add to `~/.gitconfig`:

```ini
[alias]
    # Status
    st = status
    s = status -sb
    
    # Commit
    cm = commit -m
    amend = commit --amend
    
    # Branch
    br = branch
    co = checkout
    cob = checkout -b
    
    # Log
    lg = log --oneline --graph --all --decorate
    last = log -1 HEAD
    
    # Diff
    df = diff
    dc = diff --cached
    
    # Pull/Push
    pl = pull origin
    ps = push origin
    
    # Stash
    st = stash
    stp = stash pop
    
    # Undo
    undo = reset --soft HEAD~1
    unstage = restore --staged
```

Usage:
```bash
git st          # instead of git status
git cm "message" # instead of git commit -m "message"
git lg          # pretty log
```

---

## Troubleshooting Common Issues

### Issue: Merge Conflict

```bash
# 1. See conflicted files
git status

# 2. Open file and look for:
<<<<<<< HEAD
Your changes
=======
Their changes
>>>>>>> branch-name

# 3. Edit file to resolve conflict

# 4. Mark as resolved
git add resolved-file.py

# 5. Complete merge
git commit
```

### Issue: Accidentally deleted important changes

```bash
# Find the commit hash
git reflog

# Restore from reflog
git reset --hard <commit-hash>
```

### Issue: Need to work on multiple features

```bash
# Save current work
git stash

# Work on other feature
git checkout other-feature
# ... make changes ...

# Return to original work
git checkout original-feature
git stash pop
```

---

## Resources

- [Git Official Documentation](https://git-scm.com/doc)
- [Atlassian Git Tutorials](https://www.atlassian.com/git/tutorials)
- [Git Flow Cheatsheet](https://danielkummer.github.io/git-flow-cheatsheet/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)

---

**Happy coding and committing! 🚀**
