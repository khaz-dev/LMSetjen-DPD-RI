#!/bin/bash
# GitHub Upload Verification Checklist
# Run this script to verify everything is ready for GitHub upload

echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║       GITHUB UPLOAD - VERIFICATION CHECKLIST                          ║"
echo "║              LMSetjen DPD RI - Learning Management System              ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""

passed=0
failed=0

test_check() {
    local description=$1
    local command=$2
    
    if eval "$command" > /dev/null 2>&1; then
        echo "  ✅ $description"
        ((passed++))
    else
        echo "  ❌ $description"
        ((failed++))
    fi
}

echo "═════════════════════════════════════════════════════════════════════════"
echo "PHASE 1: GIT CONFIGURATION"
echo "═════════════════════════════════════════════════════════════════════════"
echo ""
echo "Checking git configuration..."

test_check ".git directory exists" "test -d .git"
test_check "Git is initialized" "git rev-parse --is-inside-work-tree | grep -q true"
test_check "On main branch" "git branch --show-current | grep -q main"

commits=$(git rev-list --count HEAD 2>/dev/null)
echo "  ℹ️  Total commits: $commits"

echo ""
echo "═════════════════════════════════════════════════════════════════════════"
echo "PHASE 2: SECURITY - ENVIRONMENT FILES"
echo "═════════════════════════════════════════════════════════════════════════"
echo ""
echo "Checking for sensitive files..."

test_check ".env not tracked in git" "! git ls-files | grep -q '^\.env$'"
test_check ".env.example exists" "test -f backend/.env.example -a -f frontend/.env.example"
test_check ".env in .gitignore" "grep -q '\.env' .gitignore"

echo ""
echo "═════════════════════════════════════════════════════════════════════════"
echo "PHASE 3: BUILD ARTIFACTS"
echo "═════════════════════════════════════════════════════════════════════════"
echo ""
echo "Checking for build artifacts..."

if test -d frontend/dist; then
    if git ls-files frontend/dist | grep -q .; then
        echo "  ❌ frontend/dist is tracked in git"
        ((failed++))
    else
        echo "  ✅ frontend/dist is ignored"
        ((passed++))
    fi
else
    echo "  ℹ️  frontend/dist not present (OK)"
fi

test_check "frontend/node_modules ignored" "! git ls-files | grep -q frontend/node_modules"
test_check "backend/venv ignored" "! git ls-files | grep -q backend/venv"

echo ""
echo "═════════════════════════════════════════════════════════════════════════"
echo "PHASE 4: DOCUMENTATION"
echo "═════════════════════════════════════════════════════════════════════════"
echo ""
echo "Checking documentation files..."

test_check "README.md exists" "test -f README.md"
test_check "LICENSE exists" "test -f LICENSE"

echo ""
echo "═════════════════════════════════════════════════════════════════════════"
echo "PHASE 5: DEPENDENCIES"
echo "═════════════════════════════════════════════════════════════════════════"
echo ""
echo "Checking dependency files..."

test_check "backend/requirements.txt exists" "test -f backend/requirements.txt"
test_check "frontend/package.json exists" "test -f frontend/package.json"
test_check "frontend/package-lock.json exists" "test -f frontend/package-lock.json"

echo ""
echo "═════════════════════════════════════════════════════════════════════════"
echo "PHASE 6: DOCKER CONFIGURATION"
echo "═════════════════════════════════════════════════════════════════════════"
echo ""
echo "Checking Docker setup..."

test_check "docker-compose.yml exists" "test -f docker-compose.yml"
test_check "backend/Dockerfile exists" "test -f backend/Dockerfile"
test_check "frontend/Dockerfile exists" "test -f frontend/Dockerfile"

echo ""
echo "═════════════════════════════════════════════════════════════════════════"
echo "RESULTS"
echo "═════════════════════════════════════════════════════════════════════════"
echo ""
echo "✅ Passed: $passed checks"
echo "❌ Failed: $failed checks"

if [ "$failed" -eq 0 ]; then
    echo ""
    echo "✅ ALL CHECKS PASSED!"
    echo ""
    echo "Your project is ready for GitHub upload."
    echo ""
    echo "Next steps:"
    echo "  1. Create GitHub repository: https://github.com/new"
    echo "  2. Add remote: git remote add origin https://github.com/YOUR_USERNAME/lmsetjen-dpdri.git"
    echo "  3. Push code: git push -u origin main"
    echo "  4. Verify on GitHub"
else
    echo ""
    echo "⚠️  ISSUES FOUND - Please fix before uploading to GitHub"
fi

echo ""
