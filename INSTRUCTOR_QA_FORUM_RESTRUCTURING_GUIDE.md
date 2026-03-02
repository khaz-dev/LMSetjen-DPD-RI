================================================================================
INSTRUCTOR QA FORUM RESTRUCTURING GUIDE - COMPREHENSIVE IMPLEMENTATION PLAN
================================================================================

## CURRENT STATE vs TARGET STATE

### CURRENT STRUCTURE (Old Layout):
1. Sidebar with course list
2. Main content: Questions grid/list
3. When question clicked: Modal or separate view opens

### TARGET STRUCTURE (Forum-Style Per Course):
1. List of Courses as tabs/sections (like CourseDetail.jsx Diskusi tab)
2. Each course shows:
   - Course title & question count
   - Search bar for questions (with fixed icon overlap)
   - Questions displayed as forum cards (with avatars, reply counts, like counts)
   - When question clicked: Inline forum thread view opens (original post + replies)
3. When viewing thread:
   - Back button to return to questions list
   - Original question in forum-post-card
   - Replies in forum-replies-section
   - Like and report functionality
   - Reply input form below

================================================================================

## EXACT COMPONENTS TO REPLICATE FROM STUDENT FORUM

Source file: frontend/src/views/student/CourseDetail.jsx

1. FORUM QUESTION LIST (when no conversation selected):
   - Location: Lines 2987-2975 (Diskusi tab list view)
   - Shows: Questions with titles, authors, timestamps, reply counts
   - Cards styled as: forum cards with hover effects
   - Clickable: Opens the forum thread

2. FORUM QUESTION CARD:
   - Title of question
   - Author avatar (with fallback)
   - Creation date
   - Reply count badge
   - Like count display

3. FORUM THREAD VIEW (when conversation selected):
   - Location: Lines 3004-3600+
   - Header: Question title + back button
   - Breadcrumb: Section/Lesson context
   - Original post: forum-post-card forum-original-post
   - Replies section: forum-replies-section with forum-reply-post cards
   - Each reply: Avatar, username, timestamp, content, like button, report button
   - Actions: Like buttons with toggle functionality
   - Input form: Reply input box at bottom

================================================================================

## FILES TO MODIFY

### 1. INSTRUCTOR QA.jsx - Main restructuring

KEY SECTIONS TO ADD:

A. ADD COURSE TABS/SELECTOR:
   - Instead of sidebar, add tabs for each course
   - Show 1 course at a time or all in accordion
   - Display: Course title + question count

B. REPLACE QUESTIONS GRID WITH FORUM CARD LIST:
   - Each question becomes a forum-style card
   - Include avatar, title, author, date, reply count, like count
   - Clickable to open thread view

C. ADD FORUM THREAD VIEW:
   - When question clicked, show inline forum discussion
   - Display original post + all replies
   - Add back button to return to list

D. ADD FORUM STYLING STATE:
   - const [selectedQuestion, setSelectedQuestion] = useState(null)
   - When selectedQuestion null: show questions list
   - When selectedQuestion set: show forum thread view

EXAMPLE STRUCTURE:
```jsx
const InstructorQAPage = () => {
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  
  return (
    <>
      {!selectedQuestion ? (
        // QUESTIONS LIST VIEW
        <div>
          <CourseSelector courses={teacherCourses} />
          <QuestionsForumList 
            questions={questions}
            onSelectQuestion={setSelectedQuestion}
          />
        </div>
      ) : (
        // FORUM THREAD VIEW
        <ForumThreadView 
          question={selectedQuestion}
          onBack={() => setSelectedQuestion(null)}
        />
      )}
    </>
  );
};
```

### 2. INSTRUCTOR QA.css - Add forum styles

STYLES TO ADD:

A. Copy ALL forum styles from StudentCourseDetail.css:
   - .forum-post-card (line 5318)
   - .forum-original-post (line 5344)
   - .forum-reply-post (line 5356)
   - .forum-replies-section (line 5614)
   - .forum-user-avatar* (lines 5380-5420)
   - .forum-user-details (line 5417)
   - .forum-user-timestamp (line 5474)
   - All forum-related styles (lines 5315-5660)

B. Adjust colors/spacing if needed for instructor theme

C. Keep existing styles for:
   - Course selector
   - Search functionality
   - Buttons
   - Modals

================================================================================

## IMPLEMENTATION SEQUENCE

### STEP 1: Create Supporting Components
Create new components in frontend/src/views/instructor/Components/:

1. InstructorCourseSelector.jsx
   - Shows list of instructor's courses
   - Displays question count per course
   - Returns selected course

2. InstructorForumQuestionCard.jsx
   - Replicate forum question card
   - Shows avatar, title, author, date, reply count
   - Click handler passed as prop

3. InstructorForumThread.jsx
   - Main forum thread display
   - Shows: original post + replies + back button
   - Includes like/report functionality

### STEP 2: Update QA.jsx
1. Import the new components
2. Add selectedQuestion state
3. Restructure render logic:
   - If !selectedQuestion: show list view
   - If selectedQuestion: show thread view
4. Update handlers for question selection/deselection
5. Keep all API calls and data fetching logic intact

### STEP 3: Update QA.css
1. Copy forum styles from CourseDetail.css
2. Fix any color/spacing inconsistencies
3. Ensure styles cascade properly

### STEP 4: Test & Refine
1. Test course selection
2. Test question list display (forum card layout)
3. Test opening forum thread
4. Test back button
5. Test like/report buttons
6. Test search functionality
7. Test responsive layout

================================================================================

## KEY DATA STRUCTURES TO MAP

From Instructor QA to Student Forum:

Instructor question object → Student question object:
  - q.id                    → selectedConversation.id
  - q.qa_id                 → selectedConversation.qa_id
  - q.title                 → selectedConversation.title
  - q.profile               → selectedConversation.profile (avatar, name)
  - q.date                  → selectedConversation.date
  - q.messages              → selectedConversation.messages (replies)
  - q.likes_count           → selectedConversation.likes_count
  - q.course.*              → selectedConversation.course.* (context)

Reply message object:
  - msg.id
  - msg.message
  - msg.profile (avatar, name)
  - msg.date
  - msg.likes_count
  - msg.qa_id

================================================================================

## SEARCH ICON FIX (COMPLETED)

✅ FIXED in QA.css:
1. Changed form-control-modern padding-right from 3rem to 2.75rem
2. Changed search-icon right position from 1rem to 1.25rem
3. Increased z-index to 3 for proper layering
4. Added width: 100% to form-control-modern
5. Added specific styling for search-card button

Now the search icon and clear button will not overlap.

================================================================================

## EXACT FORUM STYLES TO COPY

From frontend/src/views/student/CourseDetail.css:

Lines 5318-5370: Base forum-post-card styles + forum-original-post + forum-reply-post
Lines 5372-5380: forum-user-info
Lines 5403-5420: forum-user-avatar + placeholder
Lines 5417-5423: forum-user-details + forum-user-name
Lines 5438-5480: forum-user-timestamp
Lines 5484-5550: forum-post-header + content + footer
Lines 5548-5550: forum-post-actions (like/report buttons)
Lines 5614-5660: forum-replies-section + forum-replies-list

All these should be copied to QA.css maintaining the same class names and structure.

================================================================================

## INSTRUCTOR-SPECIFIC MODIFICATIONS

1. No "Ajukan Pertanyaan" button (instructor reads only)
2. Maybe add "Mark as Answered" action (instructor specific)
3. Show resolved/open status badge
4. Show moderation actions (like report summary, status changes)
5. Color scheme: Keep current purple (#9b59b6) but adjust to match forum theme

================================================================================

## EXPECTED RESULT

Users will see:
1. Instructor dashboard with all their courses
2. Select a course → see all Q&A discussions in forum format
3. Click a discussion → see full thread with all replies
4. Can like/report messages (read-only)
5. Search works to filter questions
6. Back button returns to questions list

This matches the student forum experience but from the instructor's perspective
(their own courses, read-only, with additional admin features if needed).

================================================================================
