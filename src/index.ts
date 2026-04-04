import logger from './lib/model/logger.js';
import createError from './lib/helpers/create-error.js';
import publishEvent from './lib/helpers/publish-event.js';
import cloneRepo from './lib/helpers/clone-repo.js';
import installDependencies from './lib/helpers/install-dependencies.js';
import runGenerationAgent from './lib/helpers/run-generation-agent.js';
import runLint from './lib/helpers/run-lint.js';
import runTypecheck from './lib/helpers/run-typecheck.js';
import runSpecSecurityReview from './lib/helpers/run-spec-security-review.js';
import runSecurityReview from './lib/helpers/run-security-review.js';
import pushToGithub from './lib/helpers/push-to-github.js';

const WORKSPACE = process.env.WORKSPACE || '/workspace';

async function main(): Promise<void> {
  const workflowId = process.env.WORKFLOW_ID;

  if (!workflowId) {
    logger.error('Missing WORKFLOW_ID environment variable');
    process.exit(1);
  }

  const githubToken = process.env.GITHUB_TOKEN;
  const claudeCodeOauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  const redisUrl = process.env.REDIS_URL;
  const githubRepoUrl = process.env.GITHUB_REPO_URL;
  const spec = process.env.SPEC;

  if (!githubToken) {
    await createError(workflowId, 'Missing GITHUB_TOKEN environment variable', new Error('GITHUB_TOKEN is not set'));
    return;
  }

  if (!claudeCodeOauthToken) {
    await createError(workflowId, 'Missing CLAUDE_CODE_OAUTH_TOKEN environment variable', new Error('CLAUDE_CODE_OAUTH_TOKEN is not set'));
    return;
  }

  if (!redisUrl) {
    await createError(workflowId, 'Missing REDIS_URL environment variable', new Error('REDIS_URL is not set'));
    return;
  }

  if (!githubRepoUrl) {
    await createError(workflowId, 'Missing GITHUB_REPO_URL environment variable', new Error('GITHUB_REPO_URL is not set'));
    return;
  }

  if (!spec) {
    await createError(workflowId, 'Missing SPEC environment variable', new Error('SPEC is not set'));
    return;
  }

  await runSpecSecurityReview(workflowId, spec);

  try {
    await publishEvent(workflowId, 'generator:progress', 'Cloning workflow repository...');
  } catch {
    // non-fatal
  }

  try {
    await cloneRepo(githubRepoUrl, githubToken, WORKSPACE);
  } catch (err) {
    await createError(workflowId, 'Failed to clone repo', err);
  }

  try {
    await publishEvent(workflowId, 'generator:progress', 'Installing dependencies...');
  } catch {
    // non-fatal
  }

  try {
    await installDependencies(WORKSPACE);
  } catch (err) {
    await createError(workflowId, 'Failed to install dependencies', err);
  }

  try {
    await publishEvent(workflowId, 'generator:progress', 'Running generation agent...');
  } catch {
    // non-fatal
  }

  try {
    await runGenerationAgent(workflowId, WORKSPACE, spec);
  } catch (err) {
    await createError(workflowId, 'Generation agent failed', err);
  }

  try {
    await publishEvent(workflowId, 'generator:progress', 'Running lint...');
  } catch {
    // non-fatal
  }

  const lintResult = await runLint(WORKSPACE);

  if (!lintResult.success) {
    try {
      await publishEvent(workflowId, 'generator:progress', `Lint warnings/errors (non-blocking):\n${lintResult.output}`);
    } catch {
      // non-fatal
    }
  }

  try {
    await publishEvent(workflowId, 'generator:progress', 'Running typecheck...');
  } catch {
    // non-fatal
  }

  const typecheckResult = await runTypecheck(WORKSPACE);

  if (!typecheckResult.success) {
    try {
      await publishEvent(workflowId, 'generator:progress', `Typecheck warnings/errors (non-blocking):\n${typecheckResult.output}`);
    } catch {
      // non-fatal
    }
  }

  await runSecurityReview(workflowId, WORKSPACE);

  await pushToGithub(workflowId, WORKSPACE, githubRepoUrl, githubToken);

  try {
    await publishEvent(workflowId, 'generator:complete', 'Generation complete', { githubRepoUrl });
  } catch {
    // non-fatal
  }
}

main();
