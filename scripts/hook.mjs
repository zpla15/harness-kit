#!/usr/bin/env node
// Claude Code 훅 진입점 (hooks/hooks.json). 어떤 오류가 나도 세션을 막지 않도록 항상 0으로 끝난다.
//   node scripts/hook.mjs session-start   진행 기록을 대화 맥락으로 내보낸다
//   node scripts/hook.mjs pre-compact     압축 직전 git 상태를 .harness/progress.md에 저장한다
import { readFileSync } from 'node:fs';
import { autoSave, sessionContext } from '../src/handoff.mjs';

function input() {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
}

try {
  const event = input();
  const project = event.cwd || process.cwd();
  if (process.argv[2] === 'session-start') {
    const text = sessionContext(project);
    if (text) process.stdout.write(`${text}\n`);
  } else if (process.argv[2] === 'pre-compact') {
    autoSave(project, { trigger: event.trigger ?? 'auto' });
  }
} catch (error) {
  process.stderr.write(`harness-kit 훅 오류: ${error.message}\n`);
}
process.exitCode = 0;
