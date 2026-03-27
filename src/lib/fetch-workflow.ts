interface Workflow {
  id: string;
  specMarkdown: string | null;
  githubRepoUrl: string | null;
  productionServiceUrl: string | null;
  messages: Array<{ role: string; content: string; phase: string }>;
}

async function fetchWorkflow(apiUrl: string, workflowId: string): Promise<Workflow> {
  const response = await fetch(`${apiUrl}/api/v1/workflows/${workflowId}`, {
    headers: {
      'Authorization': `Bearer ${process.env.API_SECRET}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch workflow ${workflowId}: ${response.status} ${body}`);
  }

  return await response.json() as Workflow;
}

export default fetchWorkflow;
