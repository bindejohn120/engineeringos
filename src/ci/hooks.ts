import * as fs from 'fs';
import * as path from 'path';

const PRE_COMMIT_HOOK = `#!/bin/sh
# EngineeringOS pre-commit hook
# Checks: secrets, forbidden imports, basic guardrails
# Skipped if --no-verify or ENG_SKIP_HOOKS=1

if [ "$ENG_SKIP_HOOKS" = "1" ]; then
  exit 0
fi

echo "EngineeringOS: Running pre-commit checks..."

# Get staged files
STAGED=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\\.(ts|tsx|js|jsx)$' | head -100)

if [ -z "$STAGED" ]; then
  echo "EngineeringOS: No staged source files."
  exit 0
fi

# Check for secrets in staged files
SECRETS=$(echo "$STAGED" | xargs grep -l -E '(api[_-]?key|password|secret|token)\\s*[:=]\\s*["\\'][^"\\']{8,}["\\']' 2>/dev/null | head -10)

if [ -n "$SECRETS" ]; then
  echo "EngineeringOS: BLOCKED — Possible secrets found in staged files:"
  echo "$SECRETS"
  echo ""
  echo "Move secrets to environment variables or a secret manager."
  echo "To bypass: ENG_SKIP_HOOKS=1 git commit --no-verify"
  exit 1
fi

# Check for console.log in production code
CONSOLE=$(echo "$STAGED" | grep -v '\\.test\\.' | grep -v '__tests__' | xargs grep -l 'console\\.log' 2>/dev/null | head -10)

if [ -n "$CONSOLE" ]; then
  echo "EngineeringOS: WARNING — console.log found in production code:"
  echo "$CONSOLE"
  echo ""
fi

echo "EngineeringOS: Pre-commit checks passed."
exit 0
`;

const PRE_PUSH_HOOK = `#!/bin/sh
# EngineeringOS pre-push hook
# Validates guardrails before pushing

if [ "$ENG_SKIP_HOOKS" = "1" ]; then
  exit 0
fi

echo "EngineeringOS: Running pre-push validation..."

# Check if engineeringos CLI is available
if command -v engineeringos >/dev/null 2>&1; then
  engineeringos validate --format text
  EXIT_CODE=$?
  if [ $EXIT_CODE -eq 2 ]; then
    echo ""
    echo "EngineeringOS: BLOCKED — Guardrail violations detected."
    echo "Fix violations or bypass with: ENG_SKIP_HOOKS=1 git push --no-verify"
    exit 1
  fi
else
  echo "EngineeringOS: CLI not found, skipping validation."
  echo "Install: npm install -g engineeringos"
fi

echo "EngineeringOS: Pre-push checks passed."
exit 0
`;

export function installHooks(rootPath: string): { preCommit: string; prePush: string } {
  const hooksDir = path.join(rootPath, '.git', 'hooks');
  if (!fs.existsSync(hooksDir)) {
    throw new Error('Git hooks directory not found. Is this a git repository?');
  }

  const preCommitPath = path.join(hooksDir, 'pre-commit');
  const prePushPath = path.join(hooksDir, 'pre-push');

  fs.writeFileSync(preCommitPath, PRE_COMMIT_HOOK, { mode: 0o755 });
  fs.writeFileSync(prePushPath, PRE_PUSH_HOOK, { mode: 0o755 });

  return { preCommit: preCommitPath, prePush: prePushPath };
}

export function uninstallHooks(rootPath: string): void {
  const hooksDir = path.join(rootPath, '.git', 'hooks');
  const preCommitPath = path.join(hooksDir, 'pre-commit');
  const prePushPath = path.join(hooksDir, 'pre-push');

  if (fs.existsSync(preCommitPath)) {
    const content = fs.readFileSync(preCommitPath, 'utf-8');
    if (content.includes('EngineeringOS')) fs.unlinkSync(preCommitPath);
  }
  if (fs.existsSync(prePushPath)) {
    const content = fs.readFileSync(prePushPath, 'utf-8');
    if (content.includes('EngineeringOS')) fs.unlinkSync(prePushPath);
  }
}

export function hooksInstalled(rootPath: string): { preCommit: boolean; prePush: boolean } {
  const hooksDir = path.join(rootPath, '.git', 'hooks');
  const preCommitPath = path.join(hooksDir, 'pre-commit');
  const prePushPath = path.join(hooksDir, 'pre-push');

  return {
    preCommit: fs.existsSync(preCommitPath) && fs.readFileSync(preCommitPath, 'utf-8').includes('EngineeringOS'),
    prePush: fs.existsSync(prePushPath) && fs.readFileSync(prePushPath, 'utf-8').includes('EngineeringOS')
  };
}
