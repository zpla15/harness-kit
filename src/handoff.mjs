// 세션 사이에 진행 상태를 잇는다 (docs/workflow.md 5장).
// 세션 시작 때 진행 기록을 읽어 주고, 대화가 압축되기 직전에 git 상태를 자동 저장한다.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { workItems } from './work.mjs';
import { WORK_DIR } from './export.mjs';

export const STATE_DIR = '.harness';
export const AUTO_HEAD = '## 자동 저장';
const MAX_PROGRESS_LINES = 80;
const MAX_STATUS_LINES = 20;

const progressPath = (project) => join(project, STATE_DIR, 'progress.md');

function git(project, args) {
  try {
    return execFileSync('git', args, { cwd: project, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function readConfig(project) {
  try {
    return JSON.parse(readFileSync(join(project, STATE_DIR, 'config.json'), 'utf8'));
  } catch {
    return null;
  }
}

const dirs = (path) => (existsSync(path) ? readdirSync(path, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name) : []);

// docs/product/{기능}/dev.md 가운데 체크 안 된 작업이 남은 것.
export function openTasks(project) {
  const result = [];
  for (const feature of dirs(join(project, 'docs', 'product'))) {
    const path = join(project, 'docs', 'product', feature, 'dev.md');
    if (!existsSync(path)) continue;
    try {
      const { left } = workItems(path);
      if (left.length) result.push({ feature, left });
    } catch {
      // 읽을 수 없는 개발 스펙은 세션 시작을 막지 않는다.
    }
  }
  return result;
}

export function sessionContext(project) {
  const config = readConfig(project);
  const progress = existsSync(progressPath(project)) ? readFileSync(progressPath(project), 'utf8').trim() : '';
  const planning = dirs(join(project, WORK_DIR));
  const tasks = openTasks(project);
  if (!config && !progress && !planning.length && !tasks.length) return '';
  const out = ['[harness-kit] 이 프로젝트에서 이어서 할 일이다. 사용자가 다른 일을 시키면 그 일을 먼저 한다.'];
  if (config) out.push(`설정: 유형 ${config.type ?? '?'} · 커밋 ${config.commit ?? '?'} · 검증 ${(config.verify ?? []).join(' && ') || '없음'}`);
  if (progress) {
    const lines = progress.split('\n');
    out.push('', `--- ${STATE_DIR}/progress.md ---`, ...lines.slice(0, MAX_PROGRESS_LINES));
    if (lines.length > MAX_PROGRESS_LINES) out.push(`(… ${lines.length - MAX_PROGRESS_LINES}줄 더 있다. 필요하면 파일을 읽는다)`);
  }
  if (tasks.length) out.push('', '남은 개발 작업: ' + tasks.map(({ feature, left }) => `${feature} ${left.join(', ')}`).join(' / '));
  if (planning.length) out.push(`진행 중인 기획: ${planning.map((name) => `${WORK_DIR}/${name}`).join(', ')} (/ks-plan 또는 /ks-dev로 잇는다)`);
  return out.join('\n');
}

// progress.md 맨 끝의 자동 저장 칸만 새로 쓴다. 사람이나 /ks-handoff가 쓴 위쪽은 그대로 둔다.
export function autoSave(project, { trigger = 'auto', now = new Date() } = {}) {
  if (!existsSync(join(project, STATE_DIR))) return null;
  const path = progressPath(project);
  const before = existsSync(path) ? readFileSync(path, 'utf8') : '# 진행 기록\n';
  const kept = before.split(`\n${AUTO_HEAD}`)[0].trimEnd();
  const status = git(project, ['status', '--short']).split('\n').filter(Boolean);
  const section = [
    AUTO_HEAD,
    '',
    `대화 압축 직전에 훅이 남겼다. 다음 /ks-handoff 때 위쪽 기록에 반영한다.`,
    '',
    `- 시각: ${now.toLocaleString('sv-SE')} (${trigger})`,
    `- 브랜치: ${git(project, ['branch', '--show-current']) || '알 수 없음'}`,
    `- 최근 커밋: ${git(project, ['log', '--oneline', '-3']).split('\n').filter(Boolean).join(' / ') || '없음'}`,
    `- 바뀐 파일: ${status.length}개`,
    ...status.slice(0, MAX_STATUS_LINES).map((line) => `  - \`${line}\``),
    ...(status.length > MAX_STATUS_LINES ? [`  - … ${status.length - MAX_STATUS_LINES}개 더`] : []),
    ...openTasks(project).map(({ feature, left }) => `- 남은 작업: ${feature} ${left.join(', ')}`),
  ];
  mkdirSync(join(project, STATE_DIR), { recursive: true });
  writeFileSync(path, `${kept}\n\n${section.join('\n')}\n`);
  return path;
}
