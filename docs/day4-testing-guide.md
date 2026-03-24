# 📘 Day 4: Testing Foundation — Kiến thức cần học

## Mục tiêu
Viết unit tests + integration tests cho NestJS app. Hiểu TDD mindset.

---

## 1. Jest — Test Framework

### Jest là gì?
Jest = framework chạy tests phổ biến nhất cho JavaScript/TypeScript. NestJS dùng Jest mặc định.

### Cấu trúc 1 test file:
```typescript
describe('Tên nhóm test', () => {
  // Setup — chạy TRƯỚC mỗi test
  beforeEach(() => { /* khởi tạo */ });
  
  // Cleanup — chạy SAU mỗi test  
  afterEach(() => { jest.clearAllMocks(); });

  it('should do something', () => {
    // Arrange — chuẩn bị data
    const input = 'hello';
    
    // Act — gọi function cần test
    const result = myFunction(input);
    
    // Assert — kiểm tra kết quả
    expect(result).toBe('HELLO');
  });
});
```

### Assertions phổ biến:
```typescript
expect(value).toBe(42);              // === (strict equality)
expect(value).toEqual({ a: 1 });     // deep equality (objects)
expect(array).toHaveLength(3);       // array length
expect(value).toBeDefined();         // not undefined
expect(value).toBeNull();            // is null
expect(fn).toThrow(Error);           // function throws
expect(fn).toHaveBeenCalled();       // mock was called
expect(fn).toHaveBeenCalledWith(42); // mock called with specific args
```

### Chạy tests:
```bash
npm run test              # Chạy tất cả unit tests
npm run test -- --watch   # Watch mode (re-run khi file thay đổi)
npm run test:cov          # Chạy + báo coverage
npm run test:e2e          # Chạy integration tests
```

---

## 2. Mocking — Giả lập Dependencies

### Tại sao cần Mock?
- Unit test chỉ test 1 class/function
- Không muốn kết nối DB/API thật (chậm, flaky)
- Mock = giả lập dependency, kiểm soát input/output

### Cách mock trong Jest:
```typescript
// Tạo mock function
const mockFn = jest.fn();

// Mock return value
mockFn.mockReturnValue(42);          // sync
mockFn.mockResolvedValue(42);        // async (Promise.resolve)
mockFn.mockRejectedValue(new Error); // async error (Promise.reject)

// Verify mock được gọi
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledTimes(1);
expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
```

### Mock cả object (Prisma):
```typescript
const mockPrisma = {
  repository: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

// Trong test:
mockPrisma.repository.findUnique.mockResolvedValue(null);
// → Khi service gọi prisma.repository.findUnique() → return null
```

---

## 3. NestJS Testing Utilities

### Test.createTestingModule()
NestJS cung cấp cách tạo module test — inject mock dependencies:

```typescript
import { Test, TestingModule } from '@nestjs/testing';

const module: TestingModule = await Test.createTestingModule({
  controllers: [MyController],
  providers: [
    MyService,
    {
      provide: PrismaService,    // Token (class name)
      useValue: mockPrisma,      // Mock implementation
    },
  ],
}).compile();

const service = module.get<MyService>(MyService);
```

### Tại sao dùng `provide/useValue`?
- NestJS dùng **Dependency Injection** (DI)
- Controller cần Service, Service cần Prisma
- Trong test, ta "đánh tráo" Prisma thật bằng mock
- Controller/Service không biết — chúng chỉ biết interface

### Diagram:
```
Production:  Controller → Service → PrismaService → PostgreSQL
Testing:     Controller → Service → mockPrisma (jest.fn())
```

---

## 4. Unit Test vs Integration Test (E2E)

### Unit Test (`*.spec.ts`)
- Test **1 class** cô lập
- Mock tất cả dependencies
- Nhanh (< 1ms/test)
- Ví dụ: `repository.service.spec.ts`

### Integration/E2E Test (`*.e2e-spec.ts`)
- Test **toàn bộ flow**: HTTP request → response
- Dùng supertest để gửi HTTP requests
- Vẫn mock DB (hoặc dùng test DB)
- Chậm hơn (~100ms/test)
- Ví dụ: `test/health.e2e-spec.ts`

```typescript
import * as request from 'supertest';

// Gửi GET request, expect 200
request(app.getHttpServer())
  .get('/health')
  .expect(200)
  .expect((res) => {
    expect(res.body.status).toBe('ok');
  });
```

---

## 5. TDD Mindset — Test-Driven Development

### Quy trình RED → GREEN → REFACTOR:
1. **RED:** Viết test TRƯỚC → test FAIL (chưa có code)
2. **GREEN:** Viết code TỐI THIỂU để test PASS
3. **REFACTOR:** Clean up code, test vẫn pass

### Tại sao TDD?
- Buộc bạn nghĩ về **behavior** trước khi code
- Tests = documentation sống (luôn up-to-date)
- Catch bugs sớm → sửa rẻ hơn
- Tự tin refactor (tests bảo vệ)

### Ví dụ TDD cho RepositoryService:
```
1. Viết test: "create should generate fullName from owner + name"
2. Test FAIL: create() chưa implement
3. Code: create() { fullName = `${dto.owner}/${dto.name}` }
4. Test PASS ✅
5. Refactor: extract helper function nếu cần
```

---

## 6. Test Coverage

### Coverage là gì?
Đo % code được tests cover:
- **Statements:** bao nhiêu dòng code được chạy
- **Branches:** bao nhiêu if/else paths được test
- **Functions:** bao nhiêu functions được gọi
- **Lines:** tương tự statements

### Chạy coverage:
```bash
npm run test:cov
```

### Output:
```
File                    | % Stmts | % Branch | % Funcs | % Lines |
------------------------|---------|----------|---------|---------|
health.controller.ts    |   100   |   100    |   100   |   100   |
repository.service.ts   |    95   |    80    |   100   |    95   |
review.service.ts       |    90   |    75    |   100   |    90   |
```

### Mục tiêu:
- **Day 4:** > 50% coverage
- **Production:** > 80% coverage
- **100% không phải mục tiêu** — test behavior, không test implementation

---

## 7. Best Practices

### ✅ DO:
- Test behavior (input → output), không test implementation
- Mỗi test độc lập — không phụ thuộc test khác
- Test cả happy path VÀ error cases
- Tên test mô tả rõ: `should throw NotFoundException when not found`
- `clearAllMocks()` sau mỗi test

### ❌ DON'T:
- Test private methods trực tiếp
- Quá nhiều mock → test không có giá trị
- Test chỉ happy path → miss bugs
- Test framework code (Prisma, NestJS) — chúng đã được test rồi

---

## 8. Chạy thử

### Install dependency cần thiết:
```bash
npm install --save-dev supertest @types/supertest
```

### Chạy unit tests:
```bash
npm run test
# Expect: 3 test suites, ~15 tests, all PASS ✅
```

### Chạy e2e tests:
```bash
npm run test:e2e
# Expect: 1 suite, 2 tests PASS ✅
```

### Chạy coverage:
```bash
npm run test:cov
# Check: health, repository, review services > 80%
```

---

## 📚 Tham khảo
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Jest Mock Functions](https://jestjs.io/docs/mock-functions)
- [Supertest](https://github.com/ladjs/supertest)
- [TDD by Example (Martin Fowler)](https://martinfowler.com/bliki/TestDrivenDevelopment.html)
