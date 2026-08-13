export interface CamundaConfig {
  restUrl: string;
  username: string;
  password: string;
}

export function getCamundaConfig(env: NodeJS.ProcessEnv = process.env): CamundaConfig {
  const restUrl = env.CAMUNDA_REST_URL;
  const username = env.CAMUNDA_USERNAME;
  const password = env.CAMUNDA_PASSWORD;
  if (!restUrl || !username || !password) {
    throw new Error(
      "Missing Camunda config: CAMUNDA_REST_URL, CAMUNDA_USERNAME, and CAMUNDA_PASSWORD must all be set"
    );
  }
  return { restUrl, username, password };
}
