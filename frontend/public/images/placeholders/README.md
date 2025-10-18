# Placeholder Images

This directory contains fallback placeholder images used when actual images fail to load or are not available.

## Files

- `default-avatar.svg` - Default user/instructor avatar (150x150)
- `default-course.svg` - Default course thumbnail (400x225)
- `default-instructor.svg` - Default instructor profile image (150x150)

## Usage

These placeholders are used as fallbacks in:
- CourseInstructor.jsx - Instructor avatars
- CourseSidebar.jsx - Course thumbnails
- Other components requiring image fallbacks

## Technical Notes

- SVG format for scalability and small file size
- Served from `/images/placeholders/` public path
- No external dependencies (self-hosted)
- Works offline and doesn't require external services
