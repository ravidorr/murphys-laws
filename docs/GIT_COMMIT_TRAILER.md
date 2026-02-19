# Git commit "unknown option trailer" fix

Cursor (and some other tools) run:

```bash
git commit --trailer 'Co-authored-by: Cursor <cursoragent@cursor.com>' -m "your message"
```

The `--trailer` option was added in **Git 2.32**. If you see:

```text
error: unknown option `trailer'
```

your Git is older than 2.32.

## Fix

**Option A (recommended): upgrade Git to 2.32 or newer**

- macOS (Homebrew): `brew upgrade git`
- Check: `git --version` (should be 2.32.0 or higher)

**Option B: use the wrapper script (no upgrade)**

From the repo root:

```bash
./scripts/git-commit.sh -m "your message"
```

That commits without `--trailer` and then amends the message to add the Co-authored-by trailer using `git interpret-trailers`, so the result matches what Cursor intends on newer Git.

**Option C: turn off Cursor’s Co-authored-by trailer**

If you use Cursor, you can disable the option that adds the Co-authored-by trailer so it runs plain `git commit -m "..."` and the error goes away.
