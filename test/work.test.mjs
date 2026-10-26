import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoSave, sessionContext } from '../src/handoff.mjs';

const EXAMPLE = fileURLToPath(new URL('../examples/post-edit/', import.meta.url));
const CLI = fileURLToPath(new URL('../scripts/pp.mjs', import.meta.url));
const HOOK = fileURLToPath(new URL('../scripts/hook.mjs', import.meta.url));

// 예시를 내보낸 프로젝트를 만든다. 결과물 dev.md에는 링크와 앵커가 붙어 있다.
function exportedProject() {
  const work = join(mkdtempSync(join(tmpdir(), 'hk-')), 'post-edit');
  cpSync(EXAMPLE, work, { recursive: true });
  const project = mkdtempSync(join(tmpdir(), 'hk-project-'));
  execFileSync('node', [CLI, 'export', work, project]);
  return project;
}

test('tasks: 내보낸 개발 스펙에서 작업과 검증을 꺼내고, 남은 작업이 있으면 1로 끝난다', () => {
  const project = exportedProject();
  const result = spawnSync('node', [CLI, 'tasks', join(project, 'docs/product/post-edit')], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  const work = JSON.parse(result.stdout);
  assert.deepEqual(work.tasks.map((task) => task.id), ['T1', 'T2', 'T3']);
  assert.deepEqual(work.tasks[1].basis, ['C1', 'E1', 'E2', 'D6'], '링크가 붙은 근거도 번호로 읽는다');
  assert.equal(work.tasks[1].phase, 'P1 · R1');
  assert.deepEqual(work.checks.map((check) => `${check.id} ${check.criterion}`), ['V1 R1-1', 'V2 R1-2', 'V3 R1-3']);
  assert.deepEqual(work.left, ['T1', 'T2', 'T3']);
});

test('done: 고른 작업 줄의 체크만 바꾸고, 없는 번호는 2로 거절한다', () => {
  const project = exportedProject();
  const dev = join(project, 'docs/product/post-edit/dev.md');
  const before = readFileSync(dev, 'utf8');
  assert.equal(spawnSync('node', [CLI, 'done', dev, 'T1', 'T3']).status, 0);
  const after = readFileSync(dev, 'utf8');
  assert.equal(after.split('\n').length, before.split('\n').length);
  assert.equal(after.replaceAll('- [x]', '- [ ]'), before, '체크 말고는 한 글자도 바뀌지 않는다');
  assert.deepEqual(JSON.parse(spawnSync('node', [CLI, 'tasks', dev], { encoding: 'utf8' }).stdout).left, ['T2']);
  assert.equal(spawnSync('node', [CLI, 'done', dev, 'T9']).status, 2);
  assert.equal(readFileSync(dev, 'utf8'), after, '거절하면 파일을 고치지 않는다');
});

test('세션 시작: 하네스도 기획도 없는 프로젝트에서는 아무것도 내지 않는다', () => {
  const empty = mkdtempSync(join(tmpdir(), 'hk-empty-'));
  assert.equal(sessionContext(empty), '');
  const result = spawnSync('node', [HOOK, 'session-start'], { input: JSON.stringify({ cwd: empty }), encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
});

test('세션 시작: 설정, 진행 기록, 남은 작업, 진행 중인 기획을 알려 준다', () => {
  const project = exportedProject();
  mkdirSync(join(project, '.harness'));
  writeFileSync(join(project, '.harness/config.json'), JSON.stringify({ type: '진행된 팀', commit: '브랜치 + PR', verify: ['npm test'] }));
  writeFileSync(join(project, '.harness/progress.md'), '# 진행 기록\n\n## 다음 할 일\n\n1. /ks-check post-edit\n');
  mkdirSync(join(project, '.product-planning/comment-edit'), { recursive: true });
  const text = spawnSync('node', [HOOK, 'session-start'], { input: JSON.stringify({ cwd: project }), encoding: 'utf8' }).stdout;
  assert.match(text, /설정: 유형 진행된 팀 · 커밋 브랜치 \+ PR · 검증 npm test/);
  assert.match(text, /1\. \/ks-check post-edit/);
  assert.match(text, /남은 개발 작업: post-edit T1, T2, T3/);
  assert.match(text, /진행 중인 기획: \.product-planning\/comment-edit/);
});

test('압축 직전 저장: 자동 저장 칸만 덮어쓰고 위쪽 기록은 그대로 둔다', () => {
  const project = exportedProject();
  assert.equal(autoSave(project), null, '.harness/가 없으면 쓰지 않는다');
  mkdirSync(join(project, '.harness'));
  const top = '# 진행 기록\n\n## 다음 할 일\n\n1. T2 하기';
  writeFileSync(join(project, '.harness/progress.md'), `${top}\n`);
  autoSave(project, { trigger: 'manual' });
  autoSave(project, { trigger: 'auto' });
  const saved = readFileSync(join(project, '.harness/progress.md'), 'utf8');
  assert.ok(saved.startsWith(top));
  assert.equal(saved.split('## 자동 저장').length, 2, '자동 저장 칸은 하나뿐이다');
  assert.match(saved, /\(auto\)/);
  assert.match(saved, /- 남은 작업: post-edit T1, T2, T3/);
  assert.ok(existsSync(join(project, '.harness/progress.md')));
});

test('훅은 입력이 깨져도 0으로 끝난다', () => {
  const result = spawnSync('node', [HOOK, 'pre-compact'], { input: '{깨진 json', encoding: 'utf8' });
  assert.equal(result.status, 0);
});
