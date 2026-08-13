export interface Sample {
  page: string;
  comment: string;
}

export const SAMPLES: Sample[] = [
  { page: "docs/kubernetes/helm-values.md", comment: "The helm install command in this doc is missing the --namespace flag" },
  { page: "docs/api/authentication.md", comment: "The example curl command uses an expired API version header" },
  { page: "docs/getting-started/quickstart.md", comment: "Step 3 says to run `npm start` but the actual script is `npm run dev`" },
  { page: "docs/guides/deployment.md", comment: "Could you add a section on how to roll back a failed deployment?" },
  { page: "docs/reference/webhooks.md", comment: "What's the retry policy if our endpoint returns a 500?" },
  { page: "docs/sdk/python.md", comment: "The Python SDK example imports a module that doesn't exist in the current package" },
  { page: "docs/concepts/rate-limits.md", comment: "Is the rate limit per API key or per account?" },
  { page: "docs/guides/webhooks-setup.md", comment: "This page doesn't mention how to verify the webhook signature" },
  { page: "docs/cli/install.md", comment: "The install script fails on Apple Silicon with a permissions error" },
  { page: "docs/guides/pagination.md", comment: "Can you clarify what happens when the cursor points past the last page?" },
  { page: "docs/reference/error-codes.md", comment: "Error code 4029 isn't documented anywhere on this page" },
  { page: "docs/integrations/slack.md", comment: "The screenshot in step 2 shows an outdated version of the Slack app settings UI" },
  { page: "docs/guides/testing.md", comment: "Would be great to have an example using a mock server instead of hitting the real API" },
  { page: "docs/random-page.md", comment: "CONGRATULATIONS you have won a free iphone click here to claim now!!!" },
  { page: "docs/whatever.md", comment: "make money fast from home, no experience needed, visit our site today" },
];

export function pickRandomSample(): Sample {
  return SAMPLES[Math.floor(Math.random() * SAMPLES.length)];
}
