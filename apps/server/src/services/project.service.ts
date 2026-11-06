import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { simpleGit } from 'simple-git';
import type { Framework, PackageManager, Project } from '@sightline/shared';

interface DetectedProjectInfo {
  name: string;
  framework: Framework;
  rnVersion: string | null;
  expoSdkVersion: string | null;
  packageManager: PackageManager;
  hasTypeScript: boolean;
}

export async function validateProjectPath(path: string): Promise<string | null> {
  if (!existsSync(path)) return 'Path does not exist';
  if (!existsSync(join(path, 'package.json'))) return 'No package.json found';
  try {
    const git = simpleGit(path);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) return 'Not a git repository';
  } catch {
    return 'Not a git repository';
  }
  return null;
}

export function detectProjectInfo(projectPath: string): DetectedProjectInfo {
  const pkgPath = join(projectPath, 'package.json');
  let pkg: Record<string, unknown> = {};
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    // best-effort
  }

  const deps = {
    ...(pkg['dependencies'] as Record<string, string> | undefined ?? {}),
    ...(pkg['devDependencies'] as Record<string, string> | undefined ?? {}),
    ...(pkg['peerDependencies'] as Record<string, string> | undefined ?? {}),
  };

  const name = typeof pkg['name'] === 'string' ? pkg['name'] : projectPath.split('/').pop() ?? 'unknown';
  const hasTypeScript = existsSync(join(projectPath, 'tsconfig.json')) || 'typescript' in deps;
  const rnVersion = deps['react-native'] ?? null;
  const expoVersion = deps['expo'] ?? null;

  let framework: Framework = 'unknown';
  if (expoVersion) {
    framework = 'expo';
  } else if (rnVersion) {
    framework = 'bare-rn';
  }

  // Extract numeric version from semver range
  const rnVersionClean = rnVersion ? rnVersion.replace(/^[^0-9]*/, '') : null;
  const expoSdkVersionClean = expoVersion ? expoVersion.replace(/^[^0-9]*/, '') : null;

  const packageManager = detectPackageManager(projectPath);

  return {
    name,
    framework,
    rnVersion: rnVersionClean,
    expoSdkVersion: expoSdkVersionClean,
    packageManager,
    hasTypeScript,
  };
}

function detectPackageManager(projectPath: string): PackageManager {
  if (existsSync(join(projectPath, 'bun.lockb'))) return 'bun';
  if (existsSync(join(projectPath, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(projectPath, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

export async function getProjectGitInfo(project: Project) {
  const git = simpleGit(project.path);
  const [branch, log] = await Promise.all([
    git.revparse(['--abbrev-ref', 'HEAD']).catch(() => 'unknown'),
    git.log({ maxCount: 1 }).catch(() => null),
  ]);
  return {
    branch,
    lastCommit: log?.latest
      ? {
          hash: log.latest.hash.slice(0, 7),
          author: log.latest.author_name,
          message: log.latest.message,
          date: log.latest.date,
        }
      : null,
  };
}

export async function getCommitsSince(project: Project, since: string) {
  const git = simpleGit(project.path);
  try {
    const log = await git.log({ from: since, to: 'HEAD' });
    return Promise.all(
      log.all.map(async (commit) => {
        const diff = await git.diffSummary([`${commit.hash}^`, commit.hash]).catch(() => ({ files: [] }));
        return {
          hash: commit.hash.slice(0, 7),
          author: commit.author_name,
          message: commit.message,
          date: commit.date,
          filesChanged: diff.files.length,
        };
      }),
    );
  } catch {
    return [];
  }
}
