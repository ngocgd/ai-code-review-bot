# 📘 Day 7: GitHub API — Read PR Data

## Mục tiêu
Authenticate GitHub App + đọc PR diff & changed files qua GitHub API.

---

## 1. GitHub App Authentication

### Flow:
```
Private Key (.pem)
       ↓
JWT (JSON Web Token) — có hiệu lực 10 phút
       ↓
Installation Access Token — có hiệu lực 1 giờ
       ↓
Gọi GitHub API với token này
```

### Tại sao phức tạp vậy?
- **JWT:** chứng minh bot là GitHub App hợp lệ (signed bằng private key)
- **Installation Token:** scoped cho từng repo/org đã install app → bảo mật hơn PAT
- Octokit `@octokit/auth-app` xử lý toàn bộ flow này tự động

---

## 2. Octokit SDK

### Install:
```bash
npm install @octokit/rest @octokit/auth-app
```

### Khởi tạo:
```typescript
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';

const octokit = new Octokit({
  authStrategy: createAppAuth,
  auth: {
    appId: process.env.GITHUB_APP_ID,
    privateKey: fs.readFileSync('./secrets/github-app.pem', 'utf-8'),
    installationId: process.env.GITHUB_INSTALLATION_ID,
  },
});
```

Sau đó gọi API bình thường — Octokit tự handle JWT + token refresh.

---

## 3. API Endpoints cần dùng

### GET PR Diff
```typescript
// Trả về unified diff dạng text
const { data } = await octokit.pulls.get({
  owner, repo, pull_number: prNumber,
  mediaType: { format: 'diff' },
});
```

### GET Changed Files
```typescript
// Trả về array files: filename, status, additions, deletions, patch
const { data } = await octokit.pulls.listFiles({
  owner, repo, pull_number: prNumber,
});

// Mỗi file có:
// - filename: "src/webhook/webhook.service.ts"
// - status: "added" | "modified" | "removed" | "renamed"
// - additions: 42
// - deletions: 5
// - patch: unified diff cho file đó
```

### GET PR Info
```typescript
const { data } = await octokit.pulls.get({
  owner, repo, pull_number: prNumber,
});
// data.title, data.body, data.user.login, data.head.sha...
```

---

## 4. Checklist Day 7

- [ ] `npm install @octokit/rest @octokit/auth-app`
- [ ] Update `.env` với GITHUB_APP_ID + INSTALLATION_ID
- [ ] Implement `GithubService` với Octokit auth
- [ ] `getPullRequestDiff()` — fetch raw diff
- [ ] `getPullRequestFiles()` — list changed files + patches
- [ ] `getPullRequestInfo()` — PR metadata
- [ ] Uncomment `GithubModule` trong `AppModule`
- [ ] Viết unit tests (mock Octokit)
- [ ] Test thật: gọi API lấy diff của PR #1

---

## 📚 Tham khảo
- [Octokit REST API](https://octokit.github.io/rest.js)
- [GitHub App Auth](https://github.com/octokit/auth-app.js)
- [Pulls API](https://docs.github.com/en/rest/pulls/pulls)
- [Pull Request Files](https://docs.github.com/en/rest/pulls/pulls#list-pull-requests-files)

## ⏭️ Day 8: Post Comments
- `createReviewComment()` — inline comment trên file/line
- `submitReview()` — APPROVE / REQUEST_CHANGES / COMMENT
