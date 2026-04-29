# 📘 Day 8: GitHub API — Post Comments & Reviews

## Mục tiêu
Bot post comments lên PR thật trên GitHub.

---

## 1. Review Comment vs PR Review

| | Review Comment | PR Review |
|---|---|---|
| Là gì | Comment trên 1 dòng cụ thể | Review tổng thể cho PR |
| Dùng khi | Chỉ ra bug/issue cụ thể ở dòng X | Tổng kết review |
| API | `pulls.createReviewComment()` | `pulls.createReview()` |
| Verdict | Không có | APPROVE / REQUEST_CHANGES / COMMENT |

### Flow review của bot:
```
1. Đọc diff → phân tích từng file
2. Tìm issues → tạo inline comments (createReviewComment)
3. Tổng kết → submit review (submitReview)
```

---

## 2. Test trên PR thật

### Quick test — post 1 comment lên PR #1:

Tạo file `scripts/test-github-api.ts`:
```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { GithubService } from '../src/github/github.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const github = app.get(GithubService);

  const owner = 'ngocgd';
  const repo = 'ai-code-review-bot';
  const prNumber = 1;

  // 1. Get PR info
  const prInfo = await github.getPullRequestInfo(owner, repo, prNumber);
  console.log('PR Info:', prInfo);

  // 2. Get changed files
  const files = await github.getPullRequestFiles(owner, repo, prNumber);
  console.log('Changed files:', files.map(f => f.filename));

  // 3. Get diff
  const diff = await github.getPullRequestDiff(owner, repo, prNumber);
  console.log('Diff length:', diff.length, 'chars');
  console.log('Diff preview:', diff.substring(0, 500));

  // 4. Post a test review
  await github.submitReview(
    owner, repo, prNumber, prInfo.headSha,
    '🤖 **AI Code Review Bot** — Test review!\n\nThis is a test comment from the bot.',
    'COMMENT',
  );
  console.log('✅ Review posted!');

  await app.close();
}

main().catch(console.error);
```

### Chạy:
```bash
npx ts-node scripts/test-github-api.ts
```

### Kiểm tra:
- Vào PR #1 trên GitHub → thấy comment từ bot

---

## 3. Checklist Day 8

- [ ] Test `getPullRequestInfo()` trên PR #1
- [ ] Test `getPullRequestFiles()` — xem list files
- [ ] Test `getPullRequestDiff()` — xem raw diff
- [ ] Test `submitReview()` — bot post comment lên PR
- [ ] Test `createReviewComment()` — inline comment (optional)
- [ ] Viết unit tests → `npm run test` pass
- [ ] Xác nhận comment hiện trên GitHub

---

## 📚 Tham khảo
- [Create a review](https://docs.github.com/en/rest/pulls/reviews#create-a-review-for-a-pull-request)
- [Create review comment](https://docs.github.com/en/rest/pulls/comments#create-a-review-comment)

## ⏭️ Day 9: Diff Parser
Parse unified diff → structured data để gửi cho LLM review.
