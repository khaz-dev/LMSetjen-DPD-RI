#!/bin/bash

################################################################################
#
#  LMSetjen DPD RI - Staging Database Cleanup Script
#  
#  This script removes unnecessary test databases from PostgreSQL
#  on the staging server (165.245.191.216)
#
#  USAGE:
#    # Run on the staging server after SSH:
#    bash cleanup-staging-databases.sh
#
#  DATABASES TO REMOVE:
#    - testdb       (test database, not used)
#    - testdb2      (test database, not used)
#    - testfixdb    (test database, not used)
#    - lmsdb_staging (old/unused LMS staging database)
#
#  DATABASES TO KEEP:
#    - kmsdb        (KMS application - DO NOT DELETE)
#    - lmsdb        (LMS application - DO NOT DELETE)
#    - postgres     (PostgreSQL system database - DO NOT DELETE)
#    - template0    (PostgreSQL template - DO NOT DELETE)
#    - template1    (PostgreSQL template - DO NOT DELETE)
#
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ════════════════════════════════════════════════════════════════════════════
# Functions
# ════════════════════════════════════════════════════════════════════════════

print_header() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_item() {
    echo -e "${CYAN}  • $1${NC}"
}

# ════════════════════════════════════════════════════════════════════════════
# Main Script
# ════════════════════════════════════════════════════════════════════════════

print_header "LMSetjen DPD RI - PostgreSQL Staging Cleanup"

# Step 1: Check Prerequisites
print_info "Step 1: Checking prerequisites..."

if ! command -v psql &> /dev/null; then
    print_error "PostgreSQL client (psql) not installed"
    exit 1
fi

print_success "PostgreSQL client found"
echo ""

# Step 2: List Current Databases
print_info "Step 2: Current databases on this server:"
echo ""

psql -U postgres -t -c "
SELECT 
    datname as 'Database',
    pg_get_userbyid(datdba) as 'Owner'
FROM pg_database 
WHERE datname NOT LIKE 'pg_%'
ORDER BY datname;
" || { print_error "Cannot connect to PostgreSQL"; exit 1; }

echo ""

# Step 3: Confirm Cleanup Action
print_warning "The following databases will be DELETED:"
print_item "testdb"
print_item "testdb2"
print_item "testfixdb"
print_item "lmsdb_staging (old staging database)"
echo ""

print_warning "IMPORTANT: These operations are IRREVERSIBLE!"
echo ""

read -p "$(echo -e ${YELLOW}Type 'DELETE ALL' to confirm removal: ${NC})" -r CONFIRM

if [ "$CONFIRM" != "DELETE ALL" ]; then
    print_warning "Cleanup cancelled"
    exit 0
fi

echo ""

# Step 4: Check if databases exist before deleting
print_info "Step 3: Checking which databases exist..."

TEST_DBS=("testdb" "testdb2" "testfixdb" "lmsdb_staging")
EXISTING_DBS=()

for db in "${TEST_DBS[@]}"; do
    if psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='$db'" | grep -q 1; then
        EXISTING_DBS+=("$db")
        print_item "Found: $db ✓"
    fi
done

echo ""

if [ ${#EXISTING_DBS[@]} -eq 0 ]; then
    print_warning "No test databases found to delete"
    exit 0
fi

echo ""

# Step 5: Create Backup Before Deletion
print_info "Step 4: Creating backups before deletion..."

BACKUP_DIR="/var/www/backups/lms"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/deleted_databases_backup_$(date +%Y%m%d_%H%M%S).sql"

for db in "${EXISTING_DBS[@]}"; do
    print_item "Backing up: $db"
    pg_dump -U postgres "$db" >> "$BACKUP_FILE" 2>/dev/null || true
done

if [ -f "$BACKUP_FILE" ]; then
    print_success "Backup created: $BACKUP_FILE"
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    print_info "Backup size: $BACKUP_SIZE"
fi

echo ""

# Step 6: Terminate Connections
print_info "Step 5: Terminating database connections..."

for db in "${EXISTING_DBS[@]}"; do
    psql -U postgres -c "
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = '$db'
        AND pid <> pg_backend_pid();
    " 2>/dev/null || true
    print_item "Connections terminated: $db"
done

echo ""

# Step 7: Delete Databases
print_info "Step 6: Deleting test databases..."

for db in "${EXISTING_DBS[@]}"; do
    if psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='$db'" | grep -q 1; then
        psql -U postgres -c "DROP DATABASE IF EXISTS $db;" 2>/dev/null
        if [ $? -eq 0 ]; then
            print_success "Deleted: $db"
        else
            print_error "Failed to delete: $db"
        fi
    fi
done

echo ""

# Step 8: Verify Deletion
print_info "Step 7: Verifying cleanup..."
echo ""

psql -U postgres -t -c "
SELECT 
    datname as 'Database',
    pg_get_userbyid(datdba) as 'Owner'
FROM pg_database 
WHERE datname NOT LIKE 'pg_%'
ORDER BY datname;
"

echo ""

# Step 9: Final Summary
print_header "✅ CLEANUP COMPLETE"

print_success "Deleted ${#EXISTING_DBS[@]} test database(s)"
print_info "Backup location: $BACKUP_FILE"
print_info "Active databases:"
print_item "kmsdb (KMS application)"
print_item "lmsdb (LMS application) ← Currently used by Docker"
print_item "postgres (PostgreSQL system)"

echo ""
print_info "Your staging server PostgreSQL is now clean!"
echo ""
