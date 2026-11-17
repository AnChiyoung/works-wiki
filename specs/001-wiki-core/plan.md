# 기술 설계: 위키 핵심 기능 (001-wiki-core)

- 상태: 확정 v1 (2026-11-17). 바꿀 때는 이 문서를 먼저 고친다.
- 기준 스펙: [spec.md](spec.md)
- 이 문서는 **어떻게** 만드는지를 다룬다.

## 1. 기술 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| 런타임 | Node.js 24 LTS (설치됨: v24.21.0) | 이미 설치되어 있고 장기 지원 버전 |
| 언어 | TypeScript | 타입 덕분에 AI가 만든 코드도 검증하기 쉬움 |
| 프레임워크 | Next.js (App Router, 최신 안정 버전) | React 기반. 서버 컴포넌트로 HTML을 서버에서 렌더링해 SEO 유지, 편집기·미리보기 같은 동적 화면은 클라이언트 컴포넌트로 |
| 화면 | React + CSS Modules | 별도 UI 라이브러리 없이 시작. 다크 모드는 CSS 변수로 |
| 입력 검증 | zod | 서버 액션·API 입력 검증 |
| 코드 강조 | Shiki | 개발 위키 핵심 기능. VS Code와 같은 문법 강조를 서버에서 미리 렌더링 |
| DB | SQLite (better-sqlite3) | 별도 DB 서버 불필요, 파일 하나로 백업 ([원칙 4](../constitution.md)) |
| DB 접근 | Drizzle ORM + 마이그레이션 | 타입 안전한 쿼리, 스키마 변경 이력 관리 |
| 검색 | SQLite FTS5 (trigram 토크나이저) | 한국어 부분 검색 지원, 추가 서버 불필요 |
| 마크업 | markdown-it (`html: false`) + 각주(markdown-it-footnote) + 접기(markdown-it-container) + 직접 만드는 플러그인(위키 링크, 색·크기, 제목 번호) | 확장이 쉬움. 규칙은 [syntax.md](syntax.md) |
| HTML 정화 | sanitize-html | XSS 방지 ([원칙 5](../constitution.md)) |
| 차이 비교 | jsdiff | 판 비교 화면 |
| 비밀번호 | @node-rs/argon2 (argon2id) | 현재 권장되는 해시 방식. 미리 빌드된 파일로 설치되어 설치 스크립트가 필요 없음 |
| 이미지 판별 | file-type | 확장자가 아닌 실제 내용으로 형식 판별 |
| 테스트 | Vitest (서비스·렌더러) + Playwright (화면 흐름) | 수용 기준을 단위·화면 수준에서 검증 |
| 외부 공개 | Cloudflare Tunnel | 공유기 포트를 열지 않고 공개 |

## 2. 전체 구조

```
브라우저 ──HTTPS──▶ Cloudflare ──Tunnel──▶ 내 PC
                                          └─ Node.js (Next.js)
                                               ├─ 페이지·서버 액션 (화면, 폼 처리)
                                               ├─ 서비스 (문서·리비전·권한 규칙)
                                               ├─ 렌더러 (마크업 → 안전한 HTML)
                                               └─ SQLite 파일 + uploads/ 폴더
```

계층 규칙:
- **페이지·서버 액션·API 라우트**는 입력을 검증하고 서비스를 호출해 결과를 화면으로 돌려준다. DB에 직접 접근하지 않는다.
- 서비스·렌더러·DB 코드는 `src/server/`에 두고 `server-only`로 표시해 브라우저 번들에 섞이지 않게 한다.
- **서비스**에 업무 규칙(권한, 리비전 생성, 충돌 감지)이 모인다. 테스트는 주로 여기를 겨냥한다.
- **렌더러**는 순수 함수(입력 텍스트 → HTML + 링크·분류 목록)로 만들어 단독 테스트가 가능하게 한다.

## 3. 폴더 구조 (예정)

```
src/
  app/                       # Next.js 라우트 (URL = 폴더)
    page.tsx                 # /  → /w/대문
    w/[...title]/page.tsx    # 문서 보기 (제목에 '/'가 들어가도 되도록 catch-all, 예: C/C++)
    edit/[...title]/         # 편집 화면 + 저장 서버 액션
    history/[...title]/
    diff/[...title]/
    move/[...title]/
    raw/[...title]/route.ts  # 원문 텍스트
    search/  recent/  backlinks/[...title]/  random/route.ts
    login/  signup/
    admin/                   # users, settings, audit
    api/preview/route.ts     # 미리보기 렌더링
    api/upload/route.ts
    files/[name]/route.ts    # 업로드 파일 전송
  components/                # 문서 본문, 목차, 편집기, 차이 보기, 접기 상자 등
  server/                    # 서버 전용 (server-only)
    config.ts                # 환경 설정 (업로드 한도 등)
    db/
      schema.ts              # Drizzle 스키마
      migrations/
    services/
      pages.ts               # 문서 조회·저장·이동·삭제
      revisions.ts           # 이력·차이·되돌리기
      auth.ts                # 가입·로그인·세션
      permissions.ts         # 권한 판단 can()
      search.ts  files.ts  audit.ts
    render/
      markup.ts              # markdown-it 설정, 플러그인 조립
      plugins/
        wikilink.ts          # [[문서]], [[분류:]], [[파일:]] (SX-22~30)
        style.ts             # {{색:}}, {{크기:}} (SX-34~39)
        headings.ts          # 제목 자동 번호, 목차, 고정 주소 (SX-10~18)
        code.ts              # Shiki 코드 강조 (SX-49~53)
      sanitize.ts
  styles/                    # 전역 CSS, 테마 변수
scripts/
  create-admin.ts      # 첫 관리자 생성 (AC-8.4)
  backup.ts            # 백업
tests/
data/                  # wiki.db, uploads/ (git 제외)
```

## 4. 데이터 모델

```
users
  id              INTEGER PK
  username        TEXT UNIQUE NOT NULL
  password_hash   TEXT NOT NULL
  role            TEXT NOT NULL   -- admin | member | system (자동 작업용, 로그인 불가)
  status          TEXT NOT NULL   -- pending | active | blocked
  created_at      INTEGER NOT NULL

user_permissions    -- 회원별 기능 권한 (관리자는 행 없이도 모든 권한)
  user_id         INTEGER FK → users
  permission      TEXT NOT NULL   -- edit | create | move | upload
  granted_by      INTEGER FK → users
  granted_at      INTEGER NOT NULL
  PRIMARY KEY(user_id, permission)

settings            -- 위키 전체 설정
  key             TEXT PK         -- 예: signup_enabled
  value           TEXT NOT NULL   -- 예: 'false' (기본값)

sessions
  id              TEXT PK         -- 난수 토큰의 SHA-256 해시 (토큰 원문은 쿠키에만)
  user_id         INTEGER FK → users
  created_at      INTEGER NOT NULL
  expires_at      INTEGER NOT NULL

pages
  id              INTEGER PK
  namespace       TEXT NOT NULL   -- main | category | file | wiki | user
  title           TEXT NOT NULL   -- 접두어를 뺀 제목
  latest_rev_id   INTEGER FK → revisions
  redirect_to     TEXT NULL       -- 넘겨주기 대상 (전체 제목)
  protection      TEXT NOT NULL DEFAULT 'none'   -- none | admin
  deleted_at      INTEGER NULL
  created_at      INTEGER NOT NULL
  UNIQUE(namespace, title)

revisions
  id              INTEGER PK
  page_id         INTEGER FK → pages
  rev_no          INTEGER NOT NULL      -- 문서별 판 번호 (1, 2, 3 …)
  author_id       INTEGER FK → users
  content         TEXT NOT NULL         -- 원문 전체 저장
  summary         TEXT
  size            INTEGER NOT NULL      -- 바이트
  size_delta      INTEGER NOT NULL
  kind            TEXT NOT NULL         -- edit | create | move | revert | delete | restore
  created_at      INTEGER NOT NULL
  UNIQUE(page_id, rev_no)

links               -- 저장할 때마다 해당 문서 행을 다시 계산
  from_page_id    INTEGER FK → pages
  to_full_title   TEXT NOT NULL         -- 존재하지 않는 문서도 기록 (빨간 링크 판단)
  PRIMARY KEY(from_page_id, to_full_title)

categories
  page_id         INTEGER FK → pages
  category        TEXT NOT NULL
  PRIMARY KEY(page_id, category)

files
  id              INTEGER PK
  page_id         INTEGER FK → pages    -- '파일:' 문서
  stored_name     TEXT NOT NULL         -- sha256 기반 이름
  mime            TEXT NOT NULL
  size            INTEGER NOT NULL
  uploader_id     INTEGER FK → users
  created_at      INTEGER NOT NULL

audit_log
  id              INTEGER PK
  actor_id        INTEGER FK → users
  action          TEXT NOT NULL         -- approve | grant | revoke | block | protect | delete | restore | setting …
  target          TEXT NOT NULL
  detail          TEXT                  -- JSON
  created_at      INTEGER NOT NULL

pages_fts           -- FTS5 가상 테이블, tokenize='trigram'
  title, content    -- 최신 판만 색인
```

설계 메모:
- 내장 `system` 사용자: 사람이 아닌 자동 작업(M1의 로그인 없는 편집, 문서 이동 시 넘겨주기 자동 생성 등)의 작성자로 쓴다. 로그인할 수 없다.
- 리비전에는 **원문 전체**를 저장한다. 차이(diff)만 저장하는 방식보다 단순하고, 개인 위키 규모에서는 용량 문제가 없다.
- 렌더링 결과(HTML)는 리비전마다 캐시해 두고, 링크 대상 문서가 생기거나 지워질 때(빨간 링크 변화) 해당 캐시를 비운다. 처음에는 캐시 없이 만들고, 느려지면 추가한다.
- 목록 기호(SX-19~21)와 제목 크기, 접기 동작(SX-18, 40~44)은 CSS와 소량의 JS로 처리한다. 렌더러는 구조와 클래스만 만든다.
- 제목 정규화: 앞뒤 공백 제거, 연속 공백은 하나로, 유니코드 NFC 정규화. 대소문자는 구분한다.

## 5. 핵심 흐름

### 문서 저장 (AC-2.4 ~ 2.6)
1. 편집 폼에는 편집을 시작할 때의 `base_rev_id`가 함께 들어 있다.
2. 서버에서 권한을 확인한다 (역할 + 문서 보호 상태).
3. 트랜잭션 시작
   - 현재 `latest_rev_id ≠ base_rev_id` 이면 → 충돌 화면 응답 (저장 안 함)
   - 내용이 이전 판과 같으면 → 저장하지 않고 문서로 이동
   - 새 리비전 추가 → `pages.latest_rev_id` 갱신
   - 렌더러로 링크·분류 추출 → `links`, `categories` 갱신
   - `pages_fts` 갱신
4. 트랜잭션 커밋 → 문서 화면으로 이동

### 권한 판단
`can(user, action, page)` 함수 하나에 모든 규칙을 모은다. 판단 순서:

1. 열람·검색·이력 보기 → 누구나 허용
2. 로그인하지 않았음 → 거부
3. 관리자 → 허용
4. 회원 상태가 `active`가 아님(대기·차단) → 거부
5. 관리 기능(보호·삭제·회원 관리·설정) → 거부
6. 문서가 "관리자만 편집"으로 보호됨 → 거부
7. `사용자:` 문서인데 본인 문서가 아님 → 거부
8. 행동에 필요한 권한이 `user_permissions`에 있으면 허용, 없으면 거부

| 행동 | 필요한 권한 |
|---|---|
| 기존 문서 편집, 되돌리기 | `edit` |
| 새 문서 만들기 | `create` |
| 문서 이동 | `move` |
| 파일 업로드 | `upload` |
| 보호·삭제·복구·회원 관리·설정 | 관리자만 |

권한은 요청마다 DB에서 읽는다. 관리자가 권한을 바꾸면 그 회원의 다음 요청부터 바로 적용된다.

## 6. URL 설계

POST로 적은 동작은 대부분 해당 페이지의 서버 액션으로 구현한다. 별도 API가 필요한 것(미리보기, 업로드)만 `/api/*` 라우트로 만든다.

| 메서드 | 경로 | 설명 | 스펙 |
|---|---|---|---|
| GET | `/` | `/w/대문`으로 이동 | AC-1.6 |
| GET | `/w/:title` | 문서 보기 (`?rev=`로 과거 판) | US-1, AC-4.3 |
| GET/POST | `/edit/:title` | 편집 화면 / 저장 | US-2 |
| POST | `/preview` | 미리보기 렌더링 | AC-2.2 |
| GET | `/history/:title` | 이력 목록 | AC-4.1 |
| GET | `/diff/:title?from=&to=` | 판 비교 | AC-4.2 |
| POST | `/revert/:title` | 되돌리기 | AC-4.4 |
| GET/POST | `/move/:title` | 문서 이동 | US-6 |
| GET | `/raw/:title` | 원문 텍스트 | 원칙 7 |
| GET | `/search?q=` | 검색 | AC-5.1, 5.2 |
| GET | `/recent` | 최근 변경 | AC-5.3 |
| GET | `/backlinks/:title` | 역링크 | AC-5.4 |
| GET | `/random` | 임의 문서 | AC-5.6 |
| GET/POST | `/upload` | 파일 업로드 | US-7 |
| GET | `/files/:name` | 파일 전송 | US-7 |
| GET/POST | `/login`; POST `/logout` | 로그인 | AC-8.2 |
| GET/POST | `/signup` | 가입 신청 (설정이 꺼져 있으면 404) | AC-8.4, 8.5 |
| GET/POST | `/admin/users` | 회원 목록, 승인·차단, 계정 직접 생성 | AC-8.6, AC-9.1, 9.3 |
| GET/POST | `/admin/users/:id/permissions` | 회원별 기능 권한 켜기·끄기 | AC-9.2 |
| GET/POST | `/admin/settings` | 가입 신청 켜기·끄기 등 | AC-9.4 |
| POST | `/admin/protect/:title`, `/admin/delete/:title`, `/admin/restore/:title` | 문서 관리 | AC-9.5, 9.6 |
| GET | `/admin/audit` | 감사 로그 | AC-9.7 |

## 7. 보안 설계
- **세션**: DB 세션 + `HttpOnly; SameSite=Lax; Path=/` 쿠키, https로 공개할 때는 `Secure`도 붙인다. 로그인할 때마다 새 토큰(32바이트 난수)을 발급하고, DB에는 토큰의 SHA-256 해시만 저장한다. 유효 기간 30일, 남은 기간이 15일 아래면 요청 때 연장(AC-8.2). 서버 컴포넌트에서는 쿠키를 고칠 수 없으므로, 쿠키는 브라우저 상한(400일) 동안 두고 만료는 DB의 `expires_at`으로만 판단한다. `Secure`는 요청이 https일 때(`x-forwarded-proto: https`) 붙인다.
- **CSRF**: 서버 액션은 Next.js의 Origin 검사를 사용하고, 직접 만든 POST API 라우트(`/api/*`)에도 같은 Origin 검사를 넣는다.
- **XSS**: 마크업 렌더링 결과를 sanitize-html의 허용 목록으로 정화한 뒤에만 화면에 넣는다. CSP 등 보안 헤더는 `next.config`의 `headers()`로 적용.
- **권한**: 화면(페이지)에서 버튼을 숨기는 것과 별개로, 모든 서버 액션·API 라우트 첫 줄에서 `can()`을 호출한다.
- **횟수 제한**: 로그인·가입 액션에 IP별 제한 (메모리 기반 간단한 제한기, 서버 한 대 기준). 로그인은 15분 안에 5번 실패하면 15분 거부(AC-8.3). 서버를 재시작하면 기록이 초기화되는 것은 허용한다. Cloudflare Tunnel 뒤에서는 `CF-Connecting-IP` 헤더로 실제 IP를 얻는다(M7에서 확인).
- **업로드**: 내용 기반 형식 검사, 저장 파일명은 해시값 사용, 업로드 폴더에서 실행 불가.
- **비밀번호**: argon2id로 해시한다. 비밀번호 원문은 로그·DB·명령행 인자 어디에도 남기지 않는다. 없는 아이디로 로그인해도 해시 검증을 한 번 수행해, 응답 시간으로 아이디가 있는지 알 수 없게 한다.
- **비밀값**: 비밀값은 `.env`에 두고 git에 올리지 않는다. (세션 토큰을 DB에 해시로 저장하므로 M2에서는 별도 세션 비밀키가 필요 없다.)

## 8. 운영
- **실행**: 개발은 `npm run dev`, 운영은 `npm run build` 후 `next start`를 Windows 서비스로 등록(예: NSSM 또는 pm2)해 PC 부팅 시 자동 시작.
- **공개**: Cloudflare Tunnel로 도메인을 연결. 공유기 포트포워딩 없음.
- **백업**: SQLite 온라인 백업 API로 매일 `data/backups/`에 복사, 최근 14일치 보관. 가능하면 외장 드라이브·클라우드 폴더에도 복사.
- **로그**: 요청 로그와 오류 로그를 파일로 남기고 일정 기간 뒤 정리.
- **시작 시 점검**: 서버가 시작될 때(`src/instrumentation.ts`) 환경 변수를 검사하고, 잘못됐으면 한국어 안내를 출력한 뒤 종료한다. 이어서 DB 마이그레이션과 기본 데이터(`system` 사용자, `대문`)를 적용한다.
- **설정 반영**: 위키 이름 등 설정은 요청할 때 읽는다(루트 레이아웃 `dynamic = 'force-dynamic'`). `.env.local`을 고치면 다시 빌드하지 않고 서버 재시작만으로 반영된다.

### M1에서 확인된 구현 메모
- **Next.js 실험 기능**: 권한 없음 화면(`forbidden()`, 403)에 `experimental.authInterrupts`를 켠다. 로그인 필요 화면(`unauthorized()`, 401)도 같은 기능을 쓴다.
- **주소 조각 디코딩**: Next.js 16.4는 `[...title]` 값을 페이지에는 인코딩된 채로(`C%2B%2B`), `generateMetadata`에는 디코딩된 채로(`C++`) 넘긴다. 페이지는 `titleFromPathSegments`로 디코딩하고 메타데이터는 그대로 쓴다. `100%`·`C#`·`URL %20 인코딩` 제목의 화면 테스트가 이 동작이 바뀌면 잡아낸다.
- **스크립트 실행**: `scripts/*.mts`는 `tsx --conditions=react-server`로 실행해 `server-only` 모듈을 불러올 수 있게 한다.

## 9. 단계별 구현 순서 (마일스톤)

| 단계 | 내용 | 관련 스펙 |
|---|---|---|
| M1 | 프로젝트 골격, DB 스키마, 문서 열람·편집(로그인 없이 로컬 전용) | US-1, US-2 |
| M2 | 첫 관리자 생성, 로그인·세션, 관리자만 편집 가능하게 | AC-8.1~8.3, AC-8.7, AC-2.1 |
| M3 | 이력·차이·되돌리기, 편집 충돌 | US-4, AC-2.5 |
| M4 | 위키 링크·빨간 링크·분류·각주·역링크, 검색, 최근 변경 | US-3, US-5 |
| M5 | 문서 이동·넘겨주기, 파일 업로드 | US-6, US-7 |
| M6 | 관리 화면, 보호·삭제·복구, 감사 로그 | AC-9.5~9.7 |
| M6+ | 회원 기능: 가입 신청 설정, 승인·차단, 기능별 권한 (필요해질 때 진행) | AC-8.4~8.6, AC-9.1~9.4 |
| M7 | 백업, 서비스 등록, Cloudflare Tunnel 공개 | 비기능 요구사항 |

각 단계는 `tasks.md`로 작업을 쪼개고, 해당 수용 기준의 테스트가 모두 통과해야 끝난 것으로 본다.
