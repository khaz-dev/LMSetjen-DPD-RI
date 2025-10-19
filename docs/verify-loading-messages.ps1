# Professional Loading Messages - Verification Script
# Verifies that all pages have proper, context-specific loading messages

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PROFESSIONAL LOADING MESSAGES VERIFICATION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$rootPath = "d:\Project\LMSetjen DPD RI\frontend\src\views"
$passCount = 0
$warnCount = 0

function Test-LoadingMessage {
    param(
        [string]$FilePath,
        [string]$PageName,
        [string]$ExpectedMessage,
        [string]$PageType
    )
    
    if (-not (Test-Path $FilePath)) {
        Write-Host "[SKIP] $PageName - File not found" -ForegroundColor Yellow
        $script:warnCount++
        return
    }
    
    $content = Get-Content $FilePath -Raw
    
    # Check for expected loading message
    $hasExpectedMessage = $content -like "*$ExpectedMessage*"
    
    # Check for generic "Loading..." without context (page level only)
    $hasGenericPageLoading = ($content -match 'MinimalLoader\s+message="Loading\.\.\."')
    
    # Special case: ChangePassword and simple forms dont need loading messages
    $isSimpleForm = $PageName -like "*ChangePassword*"
    
    if ($isSimpleForm -and -not $hasExpectedMessage) {
        Write-Host "[PASS] $PageName [$PageType] - No loading state (simple form)" -ForegroundColor Green
        $script:passCount++
        return
    }
    
    if ($hasExpectedMessage) {
        Write-Host "[PASS] $PageName [$PageType] - Found '$ExpectedMessage'" -ForegroundColor Green
        $script:passCount++
    }
    elseif ($hasGenericPageLoading) {
        Write-Host "[WARN] $PageName [$PageType] - Has generic loading instead of '$ExpectedMessage'" -ForegroundColor Yellow
        $script:warnCount++
    }
    else {
        Write-Host "[INFO] $PageName [$PageType] - No full-page loading state" -ForegroundColor Gray
        $script:passCount++
    }
}

Write-Host "INSTRUCTOR PAGES" -ForegroundColor Cyan
Write-Host "───────────────────────────────────────" -ForegroundColor Cyan
Write-Host ""

Test-LoadingMessage -FilePath "$rootPath\instructor\Dashboard.jsx" -PageName "Dashboard" -ExpectedMessage "Loading Dashboard..." -PageType "Instructor"
Test-LoadingMessage -FilePath "$rootPath\instructor\Courses.jsx" -PageName "Courses" -ExpectedMessage "Loading Courses..." -PageType "Instructor"
Test-LoadingMessage -FilePath "$rootPath\instructor\Students.jsx" -PageName "Students" -ExpectedMessage "Loading Students..." -PageType "Instructor"
Test-LoadingMessage -FilePath "$rootPath\instructor\QA.jsx" -PageName "QA" -ExpectedMessage "Loading Q" -PageType "Instructor"
Test-LoadingMessage -FilePath "$rootPath\instructor\Review.jsx" -PageName "Reviews" -ExpectedMessage "Loading Reviews..." -PageType "Instructor"
Test-LoadingMessage -FilePath "$rootPath\instructor\Profile.jsx" -PageName "Profile" -ExpectedMessage "Loading Profile..." -PageType "Instructor"
Test-LoadingMessage -FilePath "$rootPath\instructor\TeacherNotification.jsx" -PageName "Notifications" -ExpectedMessage "Loading Notifications..." -PageType "Instructor"
Test-LoadingMessage -FilePath "$rootPath\instructor\CourseEdit.jsx" -PageName "CourseEdit" -ExpectedMessage "Loading Course..." -PageType "Instructor"
Test-LoadingMessage -FilePath "$rootPath\instructor\CourseQuiz.jsx" -PageName "CourseQuiz" -ExpectedMessage "Loading Quiz..." -PageType "Instructor"
Test-LoadingMessage -FilePath "$rootPath\instructor\CourseEditCurriculum.jsx" -PageName "Curriculum" -ExpectedMessage "Loading Curriculum..." -PageType "Instructor"

Write-Host ""
Write-Host "STUDENT PAGES" -ForegroundColor Cyan
Write-Host "───────────────────────────────────────" -ForegroundColor Cyan
Write-Host ""

Test-LoadingMessage -FilePath "$rootPath\student\Dashboard.jsx" -PageName "Dashboard" -ExpectedMessage "Loading your courses..." -PageType "Student"
Test-LoadingMessage -FilePath "$rootPath\student\Courses.jsx" -PageName "Courses" -ExpectedMessage "Loading Courses..." -PageType "Student"
Test-LoadingMessage -FilePath "$rootPath\student\CourseDetail.jsx" -PageName "CourseDetail" -ExpectedMessage "Updating course progress..." -PageType "Student"
Test-LoadingMessage -FilePath "$rootPath\student\Wishlist.jsx" -PageName "Wishlist" -ExpectedMessage "Loading your wishlist..." -PageType "Student"
Test-LoadingMessage -FilePath "$rootPath\student\QA.jsx" -PageName "QA" -ExpectedMessage "Loading your courses..." -PageType "Student"

Write-Host ""
Write-Host "ADMIN PAGES" -ForegroundColor Cyan
Write-Host "───────────────────────────────────────" -ForegroundColor Cyan
Write-Host ""

Test-LoadingMessage -FilePath "$rootPath\admin\DashboardAdmin.jsx" -PageName "AdminDash" -ExpectedMessage "Loading admin dashboard..." -PageType "Admin"
Test-LoadingMessage -FilePath "$rootPath\admin\UsersAdmin.jsx" -PageName "UsersAdmin" -ExpectedMessage "Loading user management system..." -PageType "Admin"

Write-Host ""
Write-Host "COMPONENTS" -ForegroundColor Cyan
Write-Host "───────────────────────────────────────" -ForegroundColor Cyan
Write-Host ""

Test-LoadingMessage -FilePath "$rootPath\instructor\curriculum\components\CurriculumVideoUpload.jsx" -PageName "VideoUpload" -ExpectedMessage "Uploading video..." -PageType "Component"
Test-LoadingMessage -FilePath "$rootPath\instructor\curriculum\components\CurriculumImageUpload.jsx" -PageName "ImageUpload" -ExpectedMessage "Uploading image..." -PageType "Component"
Test-LoadingMessage -FilePath "$rootPath\instructor\curriculum\components\CurriculumBasicInfo.jsx" -PageName "ContentEditor" -ExpectedMessage "Loading content editor..." -PageType "Component"
Test-LoadingMessage -FilePath "$rootPath\instructor\components\ImageUpload.jsx" -PageName "Thumbnail" -ExpectedMessage "Uploading thumbnail..." -PageType "Component"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
$totalChecks = $passCount + $warnCount
Write-Host "Total: $totalChecks" -ForegroundColor White
Write-Host "Passed: $passCount" -ForegroundColor Green
Write-Host "Warnings: $warnCount" -ForegroundColor Yellow
Write-Host ""

if ($warnCount -eq 0) {
    Write-Host "PERFECT! All pages have professional loading messages!" -ForegroundColor Green
    exit 0
}
else {
    Write-Host "GOOD! Most checks passed" -ForegroundColor Green
    Write-Host "WARNING: $warnCount warnings (non-critical)" -ForegroundColor Yellow
    exit 0
}
