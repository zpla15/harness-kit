// 개발 스펙의 작업(T)과 검증(V)을 구현 검수용으로 꺼내고, 끝난 작업에 체크를 단다 (docs/workflow.md 4장).
// 작업 폴더의 dev.md와 내보낸 docs/product/{기능}/dev.md를 모두 읽는다.
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseDev } from './dev.mjs';
import { unlink } from './link.mjs';
import { InputError } from './report.mjs';

export function devPath(target) {
  const path = existsSync(target) && statSync(target).isDirectory() ? join(target, 'dev.md') : target;
  if (!existsSync(path)) throw new InputError(`개발 스펙이 없다: ${path}. /ks-dev로 먼저 쓴다.`);
  return path;
}

export function workItems(target) {
  const path = devPath(target);
  const dev = parseDev(unlink(readFileSync(path, 'utf8')));
  let phase = '';
  const tasks = [];
  for (const task of dev.tasks) {
    phase = dev.phases.filter((item) => item.line < task.line).at(-1)?.title ?? phase;
    tasks.push({ id: task.id, done: task.done, parallel: task.parallel, phase, text: task.text, basis: task.basis });
  }
  const checks = dev.checks.filter((check) => check.id).map(({ id, criterion, text }) => ({ id, criterion, text }));
  return {
    path,
    title: dev.title,
    status: dev.status,
    tasks,
    checks,
    left: tasks.filter((task) => !task.done).map((task) => task.id),
  };
}

// 작업 줄의 `- [ ]`만 `- [x]`로 바꾼다. 다른 줄과 글은 건드리지 않는다.
export function markDone(target, ids) {
  const path = devPath(target);
  const wanted = new Set(ids);
  const found = new Set();
  const lines = readFileSync(path, 'utf8').split('\n').map((line) => {
    const match = line.match(/^- \[( |x)\] (?:<a id="[^"]*"><\/a>)?(T\d+)\b/);
    if (!match || !wanted.has(match[2])) return line;
    found.add(match[2]);
    return match[1] === 'x' ? line : line.replace('- [ ]', '- [x]');
  });
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length) throw new InputError(`개발 스펙에 없는 작업이다: ${missing.join(', ')}`);
  writeFileSync(path, lines.join('\n'));
  return { path, done: [...found] };
}
