# Contributing

Part of [OwlGuild](https://github.com/OwlGuild).

## Ground rules

- Small pull requests; one concern per commit.
- English commit messages in the imperative mood ("Add error handler to server").
- Every frame type has a test that would fail if the handler broke.
- CI must be green before review.

## Local checks

```bash
npm ci
npm run build
npm test
```

## Review

Both maintainers review before merge. Keep discussion in the PR, keep scope in the diff.
