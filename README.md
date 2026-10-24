# spec-planning

새 기능을 만들기 전에 **기획서 → 상세 스펙 → 개발 스펙**을 Claude와 인터뷰하듯 채워 가는 Claude Code 플러그인.

Claude는 빈칸을 상상으로 채우지 않는다. 앞 문서의 문장을 그대로 보여 주며 질문하고, 내가 답한 것만 적는다.
빠진 분기, 끊긴 근거, 몰래 바뀐 요구사항은 Node 스크립트(`scripts/pp.mjs`)가 매번 검사해서 잡아낸다.

## 빠르게 시작

```text
/plugin marketplace add zpla15/spec-planning
/plugin install spec-planning@spec-planning
```

이 PC에서는 저장소 경로로 추가해도 된다: `/plugin marketplace add <clone한 폴더 경로>`
스킬을 손본 뒤에는 `/plugin marketplace update spec-planning`.

| 명령 | 언제 |
|---|---|
| `/ks-plan <만들고 싶은 것 한 줄>` | 새 기능 기획을 시작하거나 하던 기획을 이어 갈 때 |
| `/ks-dev <기능 영어 이름>` | 기획이 확정된 뒤 개발 스펙을 쓸 때 (기획이 덜 됐으면 기획부터 한다) |

Node 20 이상만 있으면 되고, 설치할 패키지는 없다.

## 진행 순서

| 단계 | 파일 | 채우는 것 | 명령 |
|---|---|---|---|
| 1 | `brief.md` | 왜 지금 하는지, 목표와 지표, 비즈니스 요구사항(BR) | `/ks-plan` |
| 2~3 | `plan.md` | 페르소나, 요구사항(R)과 완성 기준. 확정하면 잠근다 | `/ks-plan` |
| 4 | `spec.md` | 상태표, 조건표, 화면 흐름 분기 트리(F, FN) | `/ks-plan` |
| 5 | `dev.md`, `diagram.md` | 결정, 아키텍처, 데이터, API 계약, 오류, 작업, 검증, 시퀀스 | `/ks-dev` |

한 단계에서 검사에 걸린 게 0건이어야 다음 단계로 넘어간다.
확정과 잠금은 내가 "확정해" 했을 때만 한다.

## 질문은 이렇게 온다

```text
근거  기획 상세 스펙 › F1 › ? 수정 권한이 있는가 › **아니오**
원문  "→ [수정] 단추가 보이지 않는다"
질문  권한은 화면과 서버 중 어디서 확인하나요?
```

## 결과물

작업 중 파일은 대상 프로젝트의 `.product-planning/{기능}/`에 쌓인다(git 제외).
끝나면 `docs/product/{기능}/`로 네 문서가 나가고 작업 폴더는 정리된다.

- `prd.md`: 비개발자도 읽는 기획서
- `spec.md`: 상태·조건·분기 트리
- `dev.md`: 코드만 봐서는 모르는 개발 결정
- `diagram.md`: API 계약별 Mermaid 시퀀스

다음에 고칠 때는 `import`로 다시 작업 폴더에 불러와서 고친다.

## 검사 스크립트

```bash
node scripts/pp.mjs check examples/post-edit
```

```text
단계  개발 › 5-4. 계약
완성도  R1 3/3 · 전체 100%
추가되어야 완성
1. [안 물어봄] "F1 › … › [수정] 누름 → 수정 모달이 열린다"를 인용한 계약이나 결정이 없다.
```

명령: `init` `check` `lock` `unlock` `sheet` `quotes` `export` `import` `discard`. 자세한 건 [docs/harness.md](docs/harness.md).

## 폴더

```text
skills/ks-plan/   기획 1~4단계 스킬
skills/ks-dev/    개발 스펙·시퀀스 스킬
scripts/pp.mjs    검사 CLI
src/              파서, 규칙, 대조, 내보내기
docs/             설계와 단계별 작성법
examples/         끝까지 통과한 예시 (게시글 수정)
test/             npm test
```

문서 작성 규칙은 [설계](docs/design.md), [비즈니스 요구사항](docs/brief-guide.md), [기획](docs/planning-guide.md), [상세 스펙](docs/spec-guide.md), [개발 스펙](docs/dev-guide.md), [다이어그램](docs/diagram-guide.md)에 있다.
