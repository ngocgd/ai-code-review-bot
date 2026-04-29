import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GithubService } from './github.service';

// Mock Octokit before import
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    pulls: {
      get: jest.fn(),
      listFiles: jest.fn(),
      createReviewComment: jest.fn(),
      createReview: jest.fn(),
    },
  })),
}));

jest.mock('@octokit/auth-app', () => ({
  createAppAuth: jest.fn(),
}));

jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue('fake-private-key'),
}));

describe('GithubService', () => {
  let service: GithubService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GithubService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultVal?: string) => {
              const config: Record<string, string> = {
                GITHUB_APP_ID: '123456',
                GITHUB_INSTALLATION_ID: '789012',
                GITHUB_PRIVATE_KEY_PATH: './secrets/github-app.pem',
              };
              return config[key] ?? defaultVal;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<GithubService>(GithubService);
    service.onModuleInit();
  });

  describe('getPullRequestInfo', () => {
    it('should return mapped PR info', async () => {
      const mockPR = {
        number: 1,
        title: 'Test PR',
        body: 'Description',
        user: { login: 'dev1' },
        head: { sha: 'abc123', ref: 'feature/test' },
        base: { ref: 'main' },
        additions: 10,
        deletions: 5,
        changed_files: 3,
      };

      (service as any).octokit.pulls.get.mockResolvedValue({ data: mockPR });

      const result = await service.getPullRequestInfo('owner', 'repo', 1);

      expect(result).toEqual({
        number: 1,
        title: 'Test PR',
        body: 'Description',
        author: 'dev1',
        headSha: 'abc123',
        baseBranch: 'main',
        headBranch: 'feature/test',
        additions: 10,
        deletions: 5,
        changedFiles: 3,
      });
    });
  });

  describe('getPullRequestDiff', () => {
    it('should return raw diff string', async () => {
      const mockDiff = 'diff --git a/file.ts b/file.ts\n+added line';
      (service as any).octokit.pulls.get.mockResolvedValue({ data: mockDiff });

      const result = await service.getPullRequestDiff('owner', 'repo', 1);

      expect(result).toBe(mockDiff);
      expect((service as any).octokit.pulls.get).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        pull_number: 1,
        mediaType: { format: 'diff' },
      });
    });
  });

  describe('getPullRequestFiles', () => {
    it('should return mapped file list', async () => {
      const mockFiles = [
        {
          filename: 'src/app.ts',
          status: 'modified',
          additions: 10,
          deletions: 2,
          patch: '@@ -1,3 +1,5 @@\n+new line',
        },
        {
          filename: 'src/new.ts',
          status: 'added',
          additions: 20,
          deletions: 0,
          patch: '@@ -0,0 +1,20 @@\n+all new',
        },
      ];

      (service as any).octokit.pulls.listFiles.mockResolvedValue({ data: mockFiles });

      const result = await service.getPullRequestFiles('owner', 'repo', 1);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        filename: 'src/app.ts',
        status: 'modified',
        additions: 10,
        deletions: 2,
        patch: '@@ -1,3 +1,5 @@\n+new line',
      });
    });
  });

  describe('createReviewComment', () => {
    it('should post inline comment', async () => {
      (service as any).octokit.pulls.createReviewComment.mockResolvedValue({});

      await service.createReviewComment(
        'owner', 'repo', 1, 'sha123', 'src/app.ts', 42, 'Fix this bug',
      );

      expect((service as any).octokit.pulls.createReviewComment).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        pull_number: 1,
        commit_id: 'sha123',
        path: 'src/app.ts',
        line: 42,
        body: 'Fix this bug',
      });
    });
  });

  describe('submitReview', () => {
    it('should submit review with COMMENT event', async () => {
      (service as any).octokit.pulls.createReview.mockResolvedValue({});

      await service.submitReview(
        'owner', 'repo', 1, 'sha123', 'Looks good overall', 'COMMENT',
      );

      expect((service as any).octokit.pulls.createReview).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        pull_number: 1,
        commit_id: 'sha123',
        body: 'Looks good overall',
        event: 'COMMENT',
      });
    });

    it('should submit review with REQUEST_CHANGES', async () => {
      (service as any).octokit.pulls.createReview.mockResolvedValue({});

      await service.submitReview(
        'owner', 'repo', 1, 'sha123', 'Please fix issues', 'REQUEST_CHANGES',
      );

      expect((service as any).octokit.pulls.createReview).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'REQUEST_CHANGES' }),
      );
    });
  });
});
