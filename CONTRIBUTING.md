# Contributing to LMSetjen DPD RI

First off, thank you for considering contributing to LMSetjen DPD RI! 🎉

## Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct:
- Be respectful and inclusive
- Welcome newcomers
- Focus on what is best for the community
- Show empathy towards other community members

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues. When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples**
- **Describe the behavior you observed**
- **Explain which behavior you expected to see**
- **Include screenshots if possible**
- **Include your environment details** (OS, Python version, Node version)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide a detailed description of the suggested enhancement**
- **Explain why this enhancement would be useful**
- **List some examples of how it would be used**

### Pull Requests

1. **Fork the repo** and create your branch from `main`
2. **Make your changes** following our coding standards
3. **Test your changes** thoroughly
4. **Update documentation** if needed
5. **Create a pull request** with a clear description

## Development Process

### Setup Development Environment

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/LMSetjen-DPD-RI.git
cd LMSetjen-DPD-RI

# Add upstream remote
git remote add upstream https://github.com/khaz-dev/LMSetjen-DPD-RI.git

# Create a branch
git checkout -b feature/your-feature-name
```

### Coding Standards

#### Python (Backend)
- Follow PEP 8 style guide
- Use meaningful variable and function names
- Add docstrings to functions and classes
- Keep functions small and focused
- Write unit tests for new features

```python
# Good
def calculate_course_progress(user_id, course_id):
    """
    Calculate the progress percentage for a user in a course.
    
    Args:
        user_id (int): The user's ID
        course_id (int): The course ID
        
    Returns:
        float: Progress percentage (0-100)
    """
    # Implementation
    pass

# Bad
def calc(u, c):
    # No docstring, unclear names
    pass
```

#### JavaScript/React (Frontend)
- Use ESLint configuration provided
- Use functional components with hooks
- Keep components small and reusable
- Use meaningful component and variable names
- Add PropTypes or TypeScript types

```javascript
// Good
const CourseCard = ({ title, instructor, duration }) => {
  return (
    <div className="course-card">
      <h3>{title}</h3>
      <p>Instructor: {instructor}</p>
      <span>Duration: {duration} hours</span>
    </div>
  );
};

// Bad
const Card = ({ a, b, c }) => {
  return <div>{a}</div>;
};
```

### Commit Messages

- Use clear and descriptive commit messages
- Start with a verb in present tense
- Keep the first line under 50 characters
- Add detailed description if needed

```bash
# Good
git commit -m "Add course completion certificate feature"
git commit -m "Fix quiz submission bug when multiple choice selected"

# Bad
git commit -m "update"
git commit -m "fixed stuff"
```

### Testing

#### Backend Tests
```bash
cd backend
python manage.py test
```

#### Frontend Tests
```bash
cd frontend
npm run test
```

### Before Submitting

- [ ] Code follows project style guidelines
- [ ] Self-review of your own code
- [ ] Comments added for hard-to-understand areas
- [ ] Documentation updated if needed
- [ ] No new warnings generated
- [ ] Tests added/updated and all tests pass
- [ ] Dependencies updated in requirements.txt/package.json if needed

## Project Structure

```
backend/
  ├── api/              # Main API app
  ├── lms_api/          # Project settings
  └── manage.py

frontend/
  ├── src/
  │   ├── components/   # Reusable components
  │   ├── views/        # Page components
  │   ├── utils/        # Utility functions
  │   └── assets/       # Static assets
  └── package.json
```

## Feature Branch Workflow

1. **Create feature branch**
```bash
git checkout -b feature/amazing-feature
```

2. **Make changes and commit**
```bash
git add .
git commit -m "Add amazing feature"
```

3. **Keep your branch updated**
```bash
git fetch upstream
git rebase upstream/main
```

4. **Push to your fork**
```bash
git push origin feature/amazing-feature
```

5. **Create Pull Request** on GitHub

## Review Process

- All submissions require review
- Reviewers will provide feedback
- Make requested changes
- Once approved, maintainers will merge

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Project documentation

## Questions?

Feel free to:
- Open an issue with label "question"
- Contact maintainers
- Check existing documentation

Thank you for contributing! 🙏
