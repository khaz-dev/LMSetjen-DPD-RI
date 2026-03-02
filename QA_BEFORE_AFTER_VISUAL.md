================================================================================
BEFORE & AFTER VISUAL COMPARISON - INSTRUCTOR QA PAGE RESTRUCTURING
================================================================================

================================================================================
BEFORE: Modal-Based Q&A View
================================================================================

When user clicked "Bergabung dengan Percakapan":

┌─ SCREEN ─────────────────────────────────────────────────────┐
│                    INSTRUCTOR QA                              │
│                                                                │
│  [Back] Kursus A          [5 Pertanyaan]                     │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ Search: [_____________________]                     │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                                │
│  Questions List (still underneath):                          │
│  ┌─ Question 1 ──────────────────────────────────────┐       │
│  │ [Avatar] User           [Comments: 3]             │       │
│  │ Question Title Here                                │       │
│  │               [Join Conversation]                 │       │
│  └────────────────────────────────────────────────────┘       │
│  ┌─ Question 2 ──────────────────────────────────────┐       │
│  │ [Avatar] User           [Comments: 1]             │       │
│  │ Another Question                                   │       │
│  │               [Join Conversation]                 │       │
│  └────────────────────────────────────────────────────┘       │
│                                                                │
│  ┌─────── MODAL (Overlaid on top) ───────────────────────┐   │
│  │  [X]  💬 Diskusi                                      │   │
│  │      Join the conversation and share your thoughts  │   │
│  │                                                      │   │
│  │  ─────────────────────────────────────────────────   │   │
│  │  [Avatar] User        DD MMM, YYYY - HH:mm         │   │
│  │  This is the first message                         │   │
│  │                                                      │   │
│  │  [Avatar] User        DD MMM, YYYY - HH:mm         │   │
│  │  This is a reply                                   │   │
│  │                                                      │   │
│  │  [Textarea: Type message...]                       │   │
│  │  [Send Reply Button]                               │   │
│  │                                                      │   │
│  └─ Scrollable Modal Body ──────────────────────────────┘   │
│                                                                │
│  (Questions list blurred/disabled in background)             │
└────────────────────────────────────────────────────────────────┘

ISSUES WITH MODAL:
❌ Questions list hidden behind modal
❌ Context lost - can't see which course
❌ Modal scrolling separate from page
❌ Back requires clicking X button
❌ Poor mobile UX with fullscreen modal
❌ Jarring transition between list and detail
================================================================================
AFTER: Inline Forum Thread View
================================================================================

When user clicks "Bergabung dengan Percakapan" (same button):

┌─ SCREEN ─────────────────────────────────────────────────────┐
│                    INSTRUCTOR QA                              │
│                                                                │
│  [Back] Kursus A          [5 Pertanyaan]                     │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ Search: [_____________________]                     │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                                │
│  [←] Question Title Here                [3 balasan]          │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ FORUM THREAD VIEW (replaces questions list):       │     │
│  │                                                     │     │
│  │ ┌─ ORIGINAL POST ──────────────────────────────┐   │     │
│  │ │ [Avatar] User                                │   │     │
│  │ │ DD MMM YYYY, HH:mm                          │   │     │
│  │ │                                              │   │     │
│  │ │ Question Title Here                         │   │     │
│  │ │                                              │   │     │
│  │ │ This is the original question description   │   │     │
│  │ │ with multiple lines of text                 │   │     │
│  │ │                                              │   │     │
│  │ │ ❤️ 5 likes                                   │   │     │
│  │ └──────────────────────────────────────────────┘   │     │
│  │                                                     │     │
│  │ 💬 Balasan (3)                                    │     │
│  │                                                     │     │
│  │ ┌─ REPLY 1 ──────────────────────────────────┐   │     │
│  │ │ [Avatar] User                               │   │     │
│  │ │ DD MMM YYYY, HH:mm                         │   │     │
│  │ │ This is a reply message                    │   │     │
│  │ │ ❤️ 2 likes                                  │   │     │
│  │ └──────────────────────────────────────────────┘   │     │
│  │                                                     │     │
│  │ ┌─ REPLY 2 ──────────────────────────────────┐   │     │
│  │ │ [Avatar] User                               │   │     │
│  │ │ DD MMM YYYY, HH:mm                         │   │     │
│  │ │ Another reply                              │   │     │
│  │ │ ❤️ 0 likes                                  │   │     │
│  │ └──────────────────────────────────────────────┘   │     │
│  │                                                     │     │
│  │ ┌─ ADD REPLY ─────────────────────────────────┐   │     │
│  │ │ Tambahkan Balasan                          │   │     │
│  │ │ [Textarea: Type reply here...]             │   │     │
│  │ │                [Send Reply]                │   │     │
│  │ └──────────────────────────────────────────────┘   │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                                │
│  (No modal overlay - clean, integrated view)                 │
└────────────────────────────────────────────────────────────────┘

BENEFITS OF INLINE VIEW:
✅ Questions context still visible (course header)
✅ Full page width for forum discussion
✅ Smooth navigation - no modal jank
✅ Single scrollbar - entire discussion visible
✅ Better mobile UX - full screen for reading
✅ Consistent with student Diskusi tab experience
✅ Back button naturally integrated into layout
✅ Better for accessibility (no modal trap)
✅ Faster loading (no modal lifecycle overhead)
✅ Desktop: Can see full threads without scrolling

================================================================================
CODE STRUCTURE COMPARISON
================================================================================

BEFORE:
┌─ QA Component
│  ├─ if loading → Loading spinner
│  ├─ else if !selectedCourse → Course list
│  └─ else → Questions list (ALWAYS VISIBLE)
│      └─ Modal (ConversationShow)
│          └─ if ConversationShow → Show modal with thread

AFTER:
┌─ QA Component
│  ├─ if loading → Loading spinner
│  ├─ else if !selectedCourse → Course list
│  ├─ else if !selectedConversation → Questions list
│  └─ else → Forum thread (REPLACES questions list)

COMPONENT TREE CHANGES:

BEFORE:
<QA />
├─ <Header />
├─ <Sidebar />
├─ <Questions />  (always rendered)
└─ <Modal>
   └─ <Conversation /> (only when shown)

AFTER:
<QA />
├─ <Header />
├─ <Sidebar />
├─ (Questions OR ForumThread) - mutually exclusive

================================================================================
STATE MANAGEMENT CHANGES
================================================================================

BEFORE:
const [ConversationShow, setConversationShow] = useState(false);
const [selectedConversation, setSelectedConversation] = useState(null);

function handleConversationShow(conversation) {
  setSelectedConversation(conversation);
  setConversationShow(true);  // Show modal
}

function handleConversationClose() {
  setConversationShow(false);  // Hide modal
  // selectedConversation stays set
}

// Render:
{!selectedCourse ? (
  <CourseList />
) : (
  <>
    <QuestionsList />
    {ConversationShow && <Modal />}
  </>
)}

AFTER:
const [selectedConversation, setSelectedConversation] = useState(null);
// ConversationShow removed - no longer needed

function handleBackToQuestions() {
  setSelectedConversation(null);  // Return to list
  setQuestionSearchQuery("");
  fetchCourseQuestions(selectedCourse?.id);
}

// Render:
{!selectedCourse ? (
  <CourseList />
) : !selectedConversation ? (
  <QuestionsList />
) : (
  <ForumThread />
)}

KEY DIFFERENCE:
- BEFORE: Modal overlays, multiple states
- AFTER: Conditional rendering, single state controls flow
================================================================================

MIGRATION NOTES FOR DEVELOPERS
================================================================================

1. The same `sendNewMessage` handler works for both views
2. conversationMessages draft state still functions
3. All API calls unchanged
4. Modal styles can be removed from QA.css (but left for reference)
5. Forum CSS classes added at end of QA.css
6. No new external dependencies added
7. All existing props and handlers preserved

================================================================================
USER EXPERIENCE IMPROVEMENTS SUMMARY
================================================================================

┌─────── METRIC ─────────────────────── BEFORE ──── AFTER ──────┐
│ Context Awareness                     LOW         HIGH        │
│ Scrolling Experience                  POOR        EXCELLENT   │
│ Mobile Responsiveness                 MODERATE    EXCELLENT   │
│ Cognitive Load                        MEDIUM      LOW         │
│ Page Load Time                        SAME        SLIGHTLY+   │
│ DOM Nodes Rendered                    FEWER       MORE        │
│ CSS Complexity                        LOW         MODERATE    │
│ Accessibility Score                   GOOD        EXCELLENT   │
│ Visual Consistency                    POOR        EXCELLENT   │
└─────────────────────────────────────────────────────────────────┘

Notes:
- Slightly longer initial load due to forum CSS, but imperceptible
- More DOM nodes but all styled efficiently
- CSS complexity offset by better maintainability

================================================================================
TESTING RECOMMENDATIONS
================================================================================

✅ Visual Testing:
  □ Course selection works normally
  □ Questions list displays correctly
  □ Click question opens forum thread inline
  □ Original post displays with avatar and info
  □ Replies display with proper indentation
  □ Reply form visible at bottom
  □ Back button returns to questions list
  □ Search still works in questions list

✅ Interaction Testing:
  □ Send new reply works
  □ Draft messages saved per question
  □ Like/unlike buttons ready (API connected)
  □ Back button clears conversation state

✅ Responsive Testing:
  □ Mobile (375px): Thread readable, no overlaps
  □ Tablet (768px): Good spacing, readable
  □ Desktop (1024px+): Full width forum display

✅ Performance Testing:
  □ No memory leaks on navigate between views
  □ Modal gone - no modal-related memory overhead
  □ Smooth animations (no jank)

================================================================================

