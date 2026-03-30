import sendWebhookNotification from './lib/send-webhook-notification.js';
import createError from './lib/create-error.js';
import fetchWorkflow from './lib/fetch-workflow.js';
import cloneRepo from './lib/clone-repo.js';
import installDependencies from './lib/install-dependencies.js';
import runGenerationAgent from './lib/run-generation-agent.js';
import runLint from './lib/run-lint.js';
import runTypecheck from './lib/run-typecheck.js';
import runSecurityReview from './lib/run-security-review.js';
import pushToGithub from './lib/push-to-github.js';

const WORKSPACE = process.env.WORKSPACE || '/workspace';

async function main(): Promise<void> {
  const githubToken = process.env.GITHUB_TOKEN;
  const claudeCodeOauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  const apiUrl = process.env.API_URL;
  const apiSecret = process.env.API_SECRET;
  const workflowId = process.env.WORKFLOW_ID;

  if (!githubToken || !claudeCodeOauthToken || !apiUrl || !apiSecret || !workflowId) {
    console.error('Missing required environment variables');
    process.exit(1);
  }

  let workflow;

  try {
    workflow = await fetchWorkflow(apiUrl, workflowId);
  } catch (err) {
    console.error('Failed to fetch workflow:', err);
    process.exit(1);
  }

  const githubRepoUrl = workflow.githubRepoUrl;

  if (!githubRepoUrl) {
    await createError(workflow.id, 'Workflow has no GitHub repo URL', new Error('githubRepoUrl is null'), 'GENERATION_FAILED');
    return;
  }

  try {
    await sendWebhookNotification(workflow.id, 'info', 'Cloning workflow repository...');
  } catch {
    // non-fatal
  }

  try {
    await cloneRepo(githubRepoUrl, githubToken, WORKSPACE);
  } catch (err) {
    await createError(workflow.id, 'Failed to clone repo', err, 'GENERATION_FAILED');
  }

  try {
    await sendWebhookNotification(workflow.id, 'info', 'Installing dependencies...');
  } catch {
    // non-fatal
  }

  try {
    await installDependencies(WORKSPACE);
  } catch (err) {
    await createError(workflow.id, 'Failed to install dependencies', err, 'GENERATION_FAILED');
  }

  try {
    await sendWebhookNotification(workflow.id, 'info', 'Running generation agent...');
  } catch {
    // non-fatal
  }

  const describeMessages = workflow.messages.filter(m => m.phase === 'describe');

  try {
    await runGenerationAgent(
      workflow.id,
      WORKSPACE,
      workflow.specMarkdown || '',
      JSON.stringify(describeMessages),
    );
  } catch (err) {
    await createError(workflow.id, 'Generation agent failed', err, 'GENERATION_FAILED');
  }

  try {
    await sendWebhookNotification(workflow.id, 'info', 'Running lint...');
  } catch {
    // non-fatal
  }

  try {
    await runLint(WORKSPACE);
  } catch (err) {
    await createError(workflow.id, 'Lint failed', err, 'GENERATION_FAILED');
  }

  try {
    await sendWebhookNotification(workflow.id, 'info', 'Running typecheck...');
  } catch {
    // non-fatal
  }

  try {
    await runTypecheck(WORKSPACE);
  } catch (err) {
    await createError(workflow.id, 'Typecheck failed', err, 'GENERATION_FAILED');
  }

  try {
    await sendWebhookNotification(workflow.id, 'info', 'Running security review...');
  } catch {
    // non-fatal
  }

  try {
    await runSecurityReview(WORKSPACE);
  } catch (err) {
    await createError(workflow.id, 'Security review failed', err, 'GENERATION_FAILED');
  }

  try {
    await sendWebhookNotification(workflow.id, 'info', 'Pushing to GitHub...');
  } catch {
    // non-fatal
  }

  try {
    await pushToGithub(WORKSPACE, githubRepoUrl, githubToken);
  } catch (err) {
    await createError(workflow.id, 'Failed to push to GitHub', err, 'GENERATION_FAILED');
  }

  try {
    await sendWebhookNotification(workflow.id, 'info', 'Generation complete', { code: 'GENERATION_COMPLETE', githubRepoUrl });
  } catch {
    // non-fatal
  }
}

main();
