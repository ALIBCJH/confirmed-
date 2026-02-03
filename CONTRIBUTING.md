# Contributing to CONFIRMED Backend

## 🌿 Branch Naming
```
feature/description    # New features
bugfix/description     # Bug fixes
hotfix/description     # Urgent fixes
refactor/description   # Code refactoring
docs/description       # Documentation
test/description       # Tests
chore/description      # Maintenance
```

## 💬 Commit Messages
Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new endpoint
fix: resolve database connection issue
docs: update API documentation
refactor: simplify auth logic
test: add user controller tests
chore: update dependencies
```

## 🔄 Workflow

1. **Create branch**
   ```bash
   git checkout -b feature/your-feature
   ```

2. **Make changes**
   - Write clean code
   - Add comments
   - Update docs

3. **Test locally**
   ```bash
   npm test
   npm run lint
   ```

4. **Commit**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

5. **Push**
   ```bash
   git push origin feature/your-feature
   ```

6. **Open PR**
   - Fill out template
   - Link issues
   - Wait for review

## ✅ PR Requirements

- Clear description (30+ characters)
- Valid branch name
- Passing checks
- No merge conflicts
- At least 1 approval

## 🧪 Testing

```bash
# Run tests
npm test

# Run linting
npm run lint

# Check security
npm audit
```

## 📚 Documentation

Update docs when you:
- Add new endpoints
- Change APIs
- Modify configuration
- Fix bugs

## 🆘 Need Help?

- Open an issue
- Ask in PR comments
- Check existing docs
