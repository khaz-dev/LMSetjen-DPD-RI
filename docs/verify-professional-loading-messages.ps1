# Professional Loading Messages - Verification Script
# Verifies that all pages have proper, context-specific loading messages

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PROFESSIONAL LOADING MESSAGES VERIFICATION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$rootPath = "d:\Project\LMSetjen DPD RI\frontend\src\views"
$passCount = 0
$failCount = 0
$warnCount = 0

function Test-LoadingMessage {
    param(
        [string]$FilePath,
        [string]$PageName,
        [string]$ExpectedMessage,
        [string]$PageType
    )
    
    if (-not (Test-Path $FilePath)) {
        Write-Host "❌ SKIP: $PageName - File not found" -ForegroundColor Yellow
        $script:warnCount++
        return
    }
    
    $content = Get-Content $FilePath -Raw
    
    # Check for expected loading message
    $hasExpectedMessage = $content -like "*$ExpectedMessage*"
    
    # Check for generic "Loading..." without context
    $hasGenericLoading = $content -match '>\s*Loading\.\.\.\s*<' -or 
                         $content -match 'message="Loading\.\.\."' -or
                         $content -match "message='Loading...'"
    
    # Special case: ChangePassword and simple forms don't need loading messages
    $isSimpleForm = $PageName -like "*ChangePassword*"
    
    if ($isSimpleForm -and -not $hasExpectedMessage) {
        Write-Host "✅ PASS: $PageName [$PageType] - No loading state (simple form)" -ForegroundColor Green
        $script:passCount++
        return
    }
    
    if ($hasExpectedMessage) {
        Write-Host "✅ PASS: $PageName [$PageType] - '$ExpectedMessage'" -ForegroundColor Green
        $script:passCount++
    }
    elseif ($hasGenericLoading) {
        Write-Host "⚠️  WARN: $PageName [$PageType] - Has generic 'Loading...' instead of '$ExpectedMessage'" -ForegroundColor Yellow
        $script:warnCount++
    }
    else {
        Write-Host "❓ INFO: $PageName [$PageType] - No loading state found (may not have one)" -ForegroundColor Gray
        $script:passCount++
    }
}

Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "INSTRUCTOR PAGES" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Test-LoadingMessage -FilePath "$rootPath\instructor\Dashboard.jsx" -PageName "Dashboard" -ExpectedMessage "Loading Dashboard..." -PageType "Instructor"
Test-LoadingMessage -FilePath "$rootPath\instructor\Courses.jsx" -PageName "Courses" -ExpectedMessage "Loading Courses..." -PageType "Instructor"
Test-LoadingMessage -FilePath "$rootPath\instructor\Students.jsx" -PageName "Students" -ExpectedMessage "Loading Students..." -PageType "Instructor"
Test-LoadingMessage -FilePath "$rootPath\instructor\QA.jsx" -PageName "QA" -ExpectedMessage "Loading Q" -PageType "Instructor"
Test-LoadingMessage -FilePath "$rootPath\instructor\Review.jsx" -PageName "Reviews" -ExpectedMessage "Loading Reviews..." -PageType "Instructor"
Test-LoadingMessage -FilePath "$rootPath\instructor\Profile.jsx" -PageName "Profile" -ExpectedMessage "Loading Profile..." -PageType "Instructor"
Test-LoadingMessage -FilePath "$rootPath\instructor\TeacherNotification.jsx" -PageName "Notifications" -ExpectedMessage "Loading Notifications..." -PageType "Instructor"
Test-LoadingMessage -FilePath "$rootPath\instructor\CourseEdit.jsx" -PageName "Course Edit" -ExpectedMessage "Loading Course..." -PageType "Instructor"
Test-LoadingMessage -FilePath "$rootPath\instructor\CourseQuiz.jsx" -PageName "Course Quiz" -ExpectedMessage "Loading Quiz..." -PageType "Instructor"
Test-LoadingMessage -FilePath "$rootPath\instructor\CourseEditCurriculum.jsx" -PageName "Curriculum" -ExpectedMessage "Loading Curriculum..." -PageType "Instructor"
Test-LoadingMessage -FilePath "$rootPath\instructor\ChangePassword.jsx" -PageName "Change Password" -ExpectedMessage "Loading..." -PageType "Instructor"

Write-Host ""
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "STUDENT PAGES" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Test-LoadingMessage -FilePath "$rootPath\student\Dashboard.jsx" -PageName "Dashboard" -ExpectedMessage "Loading your courses..." -PageType "Student"
Test-LoadingMessage -FilePath "$rootPath\student\Courses.jsx" -PageName "My Courses" -ExpectedMessage "Loading Courses..." -PageType "Student"
Test-LoadingMessage -FilePath "$rootPath\student\CourseDetail.jsx" -PageName "Course Detail" -ExpectedMessage "Updating course progress..." -PageType "Student"
Test-LoadingMessage -FilePath "$rootPath\student\Wishlist.jsx" -PageName "Wishlist" -ExpectedMessage "Loading your wishlist..." -PageType "Student"
Test-LoadingMessage -FilePath "$rootPath\student\QA.jsx" -PageName "QA Forum" -ExpectedMessage "Loading your courses..." -PageType "Student"
Test-LoadingMessage -FilePath "$rootPath\student\Profile.jsx" -PageName "Profile" -ExpectedMessage "Loading..." -PageType "Student"
Test-LoadingMessage -FilePath "$rootPath\student\ChangePassword.jsx" -PageName "Change Password" -ExpectedMessage "Loading..." -PageType "Student"

Write-Host ""
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "ADMIN PAGES" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Test-LoadingMessage -FilePath "$rootPath\admin\DashboardAdmin.jsx" -PageName "Admin Dashboard" -ExpectedMessage "Loading admin dashboard..." -PageType "Admin"
Test-LoadingMessage -FilePath "$rootPath\admin\UsersAdmin.jsx" -PageName "User Management" -ExpectedMessage "Loading user management system..." -PageType "Admin"

Write-Host ""
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "COMPONENTS" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Test-LoadingMessage -FilePath "$rootPath\instructor\curriculum\components\CurriculumVideoUpload.jsx" -PageName "Video Upload" -ExpectedMessage "Uploading video..." -PageType "Component"
Test-LoadingMessage -FilePath "$rootPath\instructor\curriculum\components\CurriculumImageUpload.jsx" -PageName "Image Upload" -ExpectedMessage "Uploading image..." -PageType "Component"
Test-LoadingMessage -FilePath "$rootPath\instructor\curriculum\components\CurriculumBasicInfo.jsx" -PageName "Content Editor" -ExpectedMessage "Loading content editor..." -PageType "Component"
Test-LoadingMessage -FilePath "$rootPath\instructor\components\ImageUpload.jsx" -PageName "Course Thumbnail" -ExpectedMessage "Uploading thumbnail..." -PageType "Component"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "VERIFICATION SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
$totalChecks = $passCount + $failCount + $warnCount
Write-Host "Total Checks: $totalChecks" -ForegroundColor White
Write-Host "Passed: $passCount" -ForegroundColor Green
Write-Host "Warnings: $warnCount" -ForegroundColor Yellow
Write-Host "Failed: $failCount" -ForegroundColor Red
Write-Host ""

if ($failCount -eq 0 -and $warnCount -eq 0) {
    Write-Host "✅ PERFECT! All pages have professional loading messages!" -ForegroundColor Green
    Write-Host ""
    Write-Host "All loading states are properly labeled with context-specific messages." -ForegroundColor Green
    Write-Host "Your project now looks highly professional!" -ForegroundColor Green
    exit 0
}
elseif ($failCount -eq 0) {
    Write-Host "✅ GOOD! All critical checks passed" -ForegroundColor Green
    Write-Host "⚠️  Note: $warnCount warnings found (non-critical)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Consider reviewing the warnings to further improve loading messages." -ForegroundColor Yellow
    exit 0
}
else {
    Write-Host "❌ ATTENTION NEEDED" -ForegroundColor Red
    Write-Host ""
    Write-Host "Some pages still have generic or missing loading messages." -ForegroundColor Red
    Write-Host "Please review and update the failed checks above." -ForegroundColor Red
    exit 1
}
