# Version Bumping

When bumping versions in this project:

1. Use `npm version patch|minor|major` instead of manually editing package.json files
2. This automatically:
   - Updates the version in package.json
   - Creates a git commit
   - Creates a git tag (e.g., v1.0.2)
3. Bump both package.json files (root and web) for any change
4. Requires a clean working directory - commit pending changes first if needed
5. After bumping, push both commits and tags: `git push && git push --tags`
