# Backend Infra Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing local-only `doc-feedback-triage-agent` (Camunda 8 Self-Managed + two Java job workers) into a live, internet-reachable backend: one free-tier VM running Camunda, both workers, and a Cloudflare Tunnel in front, ready for the Vercel frontend (separate plan) to talk to.

**Architecture:** One Oracle Cloud Always Free ARM VM runs Camunda 8.9 Self-Managed via Docker Compose (embedded H2, no Connectors — same trimmed shape as the existing local Helm setup) plus the existing Spring Boot worker jar as a systemd service, both talking to each other over `localhost`. Cloudflare Tunnel exposes only the REST API port (8080) publicly over HTTPS under a subdomain; the gRPC port (26500) never leaves the VM. No inbound cloud firewall ports beyond SSH are opened — the tunnel is outbound-only from the VM.

**Tech Stack:** Docker Compose, Camunda 8.9 (`camunda/camunda` image), Java 21 / Spring Boot 3.5 (existing worker jar, unchanged code apart from Task 1), `cloudflared`, systemd, Ubuntu 24.04 ARM64.

## Global Constraints

- Free tier only: Oracle Cloud Always Free ARM (4 OCPU / 24GB RAM, per the approved spec), Cloudflare free plan. No paid services — if a free option doesn't work, stop and flag it rather than reaching for a paid one.
- **Do not publish the resulting URL anywhere** (README, LinkedIn, portfolio) — gated on the pending Camunda non-commercial license per the spec's rollout section. This plan only makes the link *work*, not public.
- The Camunda REST API must require authentication (`unprotectedApi: false` — the local dev config sets this `true`, which cannot carry over to an internet-reachable deployment). The Vercel proxy (separate plan) is the only place credentials are held; nothing else may reach Camunda directly.
- gRPC (26500) is never exposed outside the VM; only REST (8080) goes through the Cloudflare Tunnel.
- No inbound VM firewall/security-list ports beyond SSH (22). The tunnel needs no inbound ports at all.
- Existing local dev workflow (`mvn spring-boot:run` against `localhost:26500`/`localhost:8080` with `demo`/`demo`) must keep working unchanged after Task 1's config parameterization — defaults preserve current behavior.

## Manual vs. agent-executable steps

Tasks 2 and 3 require a human with an Oracle Cloud account and a Cloudflare account (console access, account creation, DNS) — no amount of local tooling substitutes for that. Every other task is exact commands to run once SSH access to the VM exists (either Peter runs them, or hands SSH access to whoever/whatever executes the rest of this plan). Each task states what it needs before it can start.

---

### Task 1: Make worker's Camunda credentials configurable

**Files:**
- Modify: `~/projects/camunda/doc-feedback-triage-agent/worker/src/main/resources/application.yaml:4-7`

**Interfaces:**
- Consumes: nothing new.
- Produces: two new env vars, `CAMUNDA_USERNAME` and `CAMUNDA_PASSWORD`, read the same way `ANTHROPIC_API_KEY` and `DOC_FEEDBACK_GITHUB_TOKEN` already are (via `.env`, loaded into JVM system properties by `DocFeedbackTriageApplication.loadDotEnv()` before Spring starts). Later tasks (5, 6) rely on being able to set these on the VM without touching the jar.

Why this is needed now, not later: Task 5 rotates Camunda's `demo` user off the password `demo` (required once the API is internet-reachable through the tunnel in Task 7). The worker's `application.yaml` currently hardcodes `username: demo` / `password: demo` directly — if left as-is, the VM's workers would fail to authenticate the moment Task 5 changes the password. This has to land before Task 5, not after.

- [ ] **Step 1: Edit the auth block to read from env vars with today's values as defaults**

Change `worker/src/main/resources/application.yaml`:
```yaml
camunda:
  client:
    mode: self-managed
    auth:
      method: basic
      username: ${CAMUNDA_USERNAME:demo}
      password: ${CAMUNDA_PASSWORD:demo}
    grpc-address: http://localhost:26500
    rest-address: http://localhost:8080
```
(Only `username`/`password` change; everything else in the file is untouched.)

- [ ] **Step 2: Verify local dev still works unchanged**

Run: `cd ~/projects/camunda/doc-feedback-triage-agent/worker && mvn spring-boot:run`
Expected: starts and connects to `localhost:26500`/`localhost:8080` exactly as before — no `CAMUNDA_USERNAME`/`CAMUNDA_PASSWORD` set anywhere, so it falls back to `demo`/`demo`, matching the local Helm cluster's existing credentials. Stop it with Ctrl-C once you see it's polling for jobs without auth errors.

- [ ] **Step 3: Commit**

```bash
cd ~/projects/camunda/doc-feedback-triage-agent
git add worker/src/main/resources/application.yaml
git commit -m "Make worker's Camunda basic-auth credentials configurable via env vars"
```

No push yet — this repo has two orphaned local commits ahead of `origin/main` already (see `~/.claude/worklogs/2026-08/12-camunda-online-demo-design-spec.md`); push everything together once this is confirmed working end-to-end (Task 6).

---

### Task 2: Scaffold and push the online-demo repo

**Files:**
- Create: `~/projects/camunda/doc-feedback-triage-online-demo/README.md`
- Create: `~/projects/camunda/doc-feedback-triage-online-demo/.gitignore`

**Interfaces:**
- Produces: the repo `github.com/pcimring/doc-feedback-triage-online-demo` (public), with `infra/` and `frontend/` directories that Tasks 3-8 and the frontend plan fill in.

The local scaffold (`~/projects/camunda/doc-feedback-triage-online-demo/`, with empty `infra/` and `frontend/` dirs and this plan already under `docs/superpowers/plans/`) was created and `git init`'d already. This task fills in the root README skeleton and pushes.

- [ ] **Step 1: Write the root README skeleton**

Create `README.md`:
```markdown
# doc-feedback-triage: online demo

Everything needed to run [`doc-feedback-triage-agent`](https://github.com/pcimring/doc-feedback-triage-agent)
as a live, publicly reachable demo, so a visitor can trigger a real run and
act as the human reviewer themselves.

## What is BPMN?

[BPMN](https://www.omg.org/spec/BPMN/2.0/) (Business Process Model and
Notation) is a standard, diagram-based way to describe a business process:
boxes and arrows for the steps, decisions, and hand-offs between people and
systems. Two short tutorials if you're new to it:

- [Camunda's BPMN introduction](https://docs.camunda.io/docs/components/modeler/bpmn/)
- [Camunda's "Learn BPMN" video series](https://camunda.com/bpmn/)

## What is this project?

`doc-feedback-triage-agent` is a small, complete example of a common
automation pattern: an LLM makes a judgment call that doesn't need to be
perfect, a human stays in the loop before anything external happens, and a
workflow engine (Camunda 8) sequences the two. See that repo's own README for
the full process walkthrough and architecture.

## Local deployment

Covered entirely in [`doc-feedback-triage-agent`'s README](https://github.com/pcimring/doc-feedback-triage-agent#running-the-demo) —
not duplicated here.

## Running the online demo

<!-- Filled in once the demo is live: what the link is, what happens when you
     use it, and the current status of the pending Camunda non-commercial
     license that gates publishing this link anywhere. -->

## Creating your own online demo

<!-- Filled in by infra Task 8: the actual runbook — VM, Camunda, Cloudflare
     Tunnel, Vercel — for anyone who wants to stand up their own copy. -->

## Repo layout

- `infra/` — VM deploy config: Docker Compose (Camunda), systemd units
  (workers, Cloudflare Tunnel).
- `frontend/` — Vercel app: submission form, status polling, and the
  visitor-facing review UI, backed by a serverless proxy that holds Camunda
  credentials server-side.
```

- [ ] **Step 2: Write `.gitignore`**

Create `.gitignore`:
```
# Node (frontend/)
node_modules/
.next/
.vercel/
*.env
*.env.local

# Infra secrets — never committed
infra/**/.env
infra/**/*.env

# OS
.DS_Store
```

- [ ] **Step 3: Commit and push as a new public GitHub repo**

```bash
cd ~/projects/camunda/doc-feedback-triage-online-demo
git add README.md .gitignore docs/
git commit -m "Scaffold online-demo repo: orientation README, infra/ and frontend/ layout"
ghwho   # confirm the personal `pcimring` account is active; if not, open a
        # new terminal tab and run `ghme` first (see reference_github_account_switch)
gh repo create pcimring/doc-feedback-triage-online-demo --public --source=. --remote=origin --push
```

Expected: repo created and visible at `https://github.com/pcimring/doc-feedback-triage-online-demo`, this commit pushed to `main`.

---

### Task 3: Provision the Oracle Cloud VM

**Manual — requires an Oracle Cloud account.** No files in this task; it produces a running VM plus an SSH keypair, which Task 4 onward depend on.

**Interfaces:**
- Produces: `VM_PUBLIC_IP` and a working `ssh -i <key> ubuntu@<VM_PUBLIC_IP>` — every later task in this plan references these.

- [ ] **Step 1: Create the Always Free Ampere A1 instance**

In the Oracle Cloud console (Compute → Instances → Create Instance):
- Image: **Canonical Ubuntu 24.04 (ARM)** — the "Always Free-eligible" image list includes it.
- Shape: **VM.Standard.A1.Flex**, 4 OCPUs / 24 GB memory (the spec's recommended sizing — this is the full Always Free ARM allocation, so don't split it across multiple instances).
- Networking: create a new VCN with a public subnet if you don't have one already (the console's default "create new virtual cloud network" flow is fine).
- SSH keys: let the console generate a keypair and download the private key (or paste your own public key if you already manage one). Save the private key somewhere durable, e.g. `~/.ssh/doc-feedback-vm.key`, and `chmod 600` it.

- [ ] **Step 2: Confirm SSH access**

Run: `chmod 600 ~/.ssh/doc-feedback-vm.key && ssh -i ~/.ssh/doc-feedback-vm.key ubuntu@<VM_PUBLIC_IP>`
Expected: logs in without a password prompt (key-based only).

- [ ] **Step 3: Lock the cloud-level firewall down to SSH only**

In the VCN's default Security List (or a Network Security Group attached to the instance): confirm only an ingress rule for TCP/22 exists from `0.0.0.0/0` (or better, your own IP/32 if it's static). Delete any other pre-created ingress rules (Oracle's quick-create sometimes adds one for the shape's default app port). **Do not open 8080 or 26500** — Cloudflare Tunnel (Task 7) needs no inbound rule at all.

- [ ] **Step 4: Confirm the OS-level firewall isn't also blocking SSH**

Run on the VM: `sudo iptables -L INPUT -n | head -20`
Expected: an ACCEPT rule for tcp dpt:22 (Oracle's Ubuntu images ship with iptables pre-configured to allow SSH; if you can already SSH in from Step 2, this is already satisfied — this step is just confirming so Task 5's local-only curl checks aren't mysteriously blocked later).

---

### Task 4: Install Docker on the VM

**Files:** none (VM package installation only).

**Interfaces:**
- Consumes: SSH access from Task 3.
- Produces: working `docker` and `docker compose` CLI on the VM — Task 5 depends on both.

- [ ] **Step 1: Install Docker Engine + Compose plugin via Docker's official apt repo**

Run on the VM:
```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker $USER
```
Then log out and back in (`exit`, re-`ssh`) so the group membership takes effect.

- [ ] **Step 2: Verify**

Run on the VM: `docker run --rm arm64v8/hello-world`
Expected: "Hello from Docker!" — confirms both the daemon and that arm64 images pull correctly on this VM.

---

### Task 5: Deploy Camunda 8.9 via Docker Compose

**Files:**
- Create: `infra/camunda/docker-compose.yaml`
- Create: `infra/camunda/.env` (gitignored — lives only on the VM, not committed)
- Create: `infra/camunda/configuration/application-h2.yaml`

**Interfaces:**
- Consumes: Docker from Task 4.
- Produces: Camunda reachable at `localhost:8080` (REST) / `localhost:26500` (gRPC) *on the VM only* — Task 6's workers and Task 7's tunnel both depend on this. Also produces the rotated `CAMUNDA_DEMO_PASSWORD`, which Task 6 must be given (via the worker's `.env`, using the env vars added in Task 1).

This adapts the existing local setup at `~/projects/camunda/camunda-selfmanaged/docker-compose-8.9/docker-compose.yaml` (referenced by the spec): same `orchestration` service (Zeebe + Operate + Tasklist consolidated, embedded H2), same `application-h2.yaml` shape, two changes: the `connectors` service is dropped (not used by this demo), and `unprotectedApi` flips to `false` with a generated password, because this instance is reachable from the internet via Task 7's tunnel — the local version's `unprotectedApi: true` only ever ran on `localhost` and can't carry over.

- [ ] **Step 1: Write `infra/camunda/docker-compose.yaml`**

```yaml
services:
  camunda-data-init:
    image: camunda/camunda:${CAMUNDA_VERSION}
    user: "0:0"
    entrypoint: ["/bin/sh", "-c", "chown -R 1001:1001 /usr/local/camunda/camunda-data && chmod 775 /usr/local/camunda/camunda-data"]
    volumes:
      - camunda-data:/usr/local/camunda/camunda-data
    restart: "no"

  orchestration:
    image: camunda/camunda:${CAMUNDA_VERSION}
    container_name: orchestration
    ports:
      - "127.0.0.1:26500:26500"
      - "127.0.0.1:9600:9600"
      - "127.0.0.1:8080:8080"
    mem_limit: 4g
    restart: always
    environment:
      - CAMUNDA_DEMO_PASSWORD=${CAMUNDA_DEMO_PASSWORD}
    healthcheck:
      test: ["CMD-SHELL", "bash -c 'exec 3<>/dev/tcp/127.0.0.1/9600 && echo -e \"GET /actuator/health/status HTTP/1.1\r\nHost: localhost\r\n\r\n\" >&3 && head -n 1 <&3'"]
      interval: 1s
      retries: 30
      start_period: 30s
    volumes:
      - camunda:/usr/local/camunda/data
      - camunda-data:/usr/local/camunda/camunda-data
    configs:
      - source: orchestration-config
        target: /usr/local/camunda/config/application.yaml
    depends_on:
      camunda-data-init:
        condition: service_completed_successfully

volumes:
  camunda:
  camunda-data:

configs:
  orchestration-config:
    file: ./configuration/application-h2.yaml
```

Three deliberate deviations from the local `docker-compose-8.9/docker-compose.yaml` this is adapted from: the `connectors` service and its config are dropped entirely (matches `values-local.yaml`'s existing `connectors.enabled: false` for the Helm setup — this demo never used Connectors); all three ports are bound to `127.0.0.1` instead of `0.0.0.0` — belt-and-suspenders on top of the cloud firewall from Task 3: even if the firewall were ever misconfigured, Docker itself won't accept a connection from outside the VM (Task 7's Cloudflare Tunnel reaches `localhost:8080` from *inside* the VM, so this doesn't block it); and the new `environment: CAMUNDA_DEMO_PASSWORD=${CAMUNDA_DEMO_PASSWORD}` entry. That last one matters: Docker Compose's `${VAR}` interpolation only rewrites the compose file's own text (here, substituting from `infra/camunda/.env`, the same mechanism the original file already relies on for `${CAMUNDA_VERSION}`) — it does **not** reach into `application-h2.yaml`, which is a separate file merely referenced by path. The `${CAMUNDA_DEMO_PASSWORD}` placeholder written into that file in Step 2 is instead resolved by Camunda's own Spring Boot process at container startup, the same way the worker's `application.yaml` already resolves `${ANTHROPIC_API_KEY}` — but that only works if the variable is actually present in the *container's* environment, which is exactly what this `environment:` entry provides.

- [ ] **Step 2: Write `infra/camunda/configuration/application-h2.yaml`**

```yaml
management.endpoints.configprops.show-values: always
camunda:
  backup:
    webapps:
      enabled: false
  system:
    cpu-thread-count: "3"
    io-thread-count: "3"
  security:
    authentication:
      method: "basic"
      unprotectedApi: false
    authorizations:
      enabled: false
    initialization:
      users:
        - username: "demo"
          password: "${CAMUNDA_DEMO_PASSWORD}"
          name: "Demo User"
          email: "demo@demo.com"
      defaultRoles.admin.users:
        - "demo"
  data:
    secondary-storage:
      type: rdbms
      rdbms:
        url: jdbc:h2:file:./camunda-data/h2db
        username: sa
        password:
        flushInterval: PT0.5S
        queueSize: 1000
```

The only functional changes from the local `docker-compose-8.9/configuration/application-h2.yaml` this is copied from: `unprotectedApi: false` (was `true`), and the `demo` user's password is `${CAMUNDA_DEMO_PASSWORD}` (was the literal string `demo`) — substituted from `.env` by Docker Compose's variable interpolation, the same mechanism the existing file already relies on for `${CAMUNDA_VERSION}`.

- [ ] **Step 3: Generate a strong password and write `infra/camunda/.env`**

Run on the VM:
```bash
CAMUNDA_DEMO_PASSWORD=$(openssl rand -base64 24)
echo "Save this — you'll need it for Task 6's worker .env and the frontend plan's Vercel env vars:"
echo "$CAMUNDA_DEMO_PASSWORD"
mkdir -p ~/doc-feedback-triage-online-demo/infra/camunda
cat > ~/doc-feedback-triage-online-demo/infra/camunda/.env <<EOF
CAMUNDA_VERSION=8.9.13
CAMUNDA_DEMO_PASSWORD=${CAMUNDA_DEMO_PASSWORD}
EOF
```
(`CAMUNDA_VERSION` pinned to the same version the local `docker-compose-8.9/.env` uses today.)

This `.env` lives only on the VM (matches the `infra/**/.env` gitignore rule from Task 2) — copy the `docker-compose.yaml` and `configuration/` files from your local checkout via `scp`, but never this file.

- [ ] **Step 4: Copy the compose files to the VM and start Camunda**

From your local machine:
```bash
scp -i ~/.ssh/doc-feedback-vm.key -r \
  ~/projects/camunda/doc-feedback-triage-online-demo/infra/camunda/docker-compose.yaml \
  ~/projects/camunda/doc-feedback-triage-online-demo/infra/camunda/configuration \
  ubuntu@<VM_PUBLIC_IP>:~/doc-feedback-triage-online-demo/infra/camunda/
```
Then on the VM:
```bash
cd ~/doc-feedback-triage-online-demo/infra/camunda
docker compose up -d
docker compose ps
```
Expected: `camunda-data-init` exits 0, `orchestration` shows `healthy` within ~30-60s.

- [ ] **Step 5: Verify auth is actually required, and that the right password works**

Run on the VM:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/v2/topology
```
Expected: `401` (confirms `unprotectedApi: false` took effect — this must NOT be `200`).

```bash
curl -s -u "demo:${CAMUNDA_DEMO_PASSWORD}" http://localhost:8080/v2/topology
```
Expected: `200` with a JSON topology response (confirms the generated password from Step 3 works).

- [ ] **Step 6: Deploy the BPMN process**

Run on the VM (from your local machine, `scp` the model over first):
```bash
scp -i ~/.ssh/doc-feedback-vm.key \
  ~/projects/camunda/doc-feedback-triage-agent/models/doc-feedback-triage.bpmn \
  ubuntu@<VM_PUBLIC_IP>:~/
ssh -i ~/.ssh/doc-feedback-vm.key ubuntu@<VM_PUBLIC_IP> \
  "curl -u demo:${CAMUNDA_DEMO_PASSWORD} -F 'resources=@doc-feedback-triage.bpmn' http://localhost:8080/v2/deployments"
```
Expected: `200` with a JSON body confirming `doc-feedback-triage` deployed (matches the deploy step in `doc-feedback-triage-agent`'s own README, just against the VM instead of local k3s).

---

### Task 6: Deploy both job workers as a systemd service

**Files:**
- Create: `infra/worker/doc-feedback-workers.service` (systemd unit, committed as a template)
- Create (on VM only, not committed): `/opt/doc-feedback-workers/.env`

**Interfaces:**
- Consumes: `CAMUNDA_DEMO_PASSWORD` from Task 5, the `CAMUNDA_USERNAME`/`CAMUNDA_PASSWORD` env vars added in Task 1, the built jar from `doc-feedback-triage-agent`.
- Produces: a running worker process on the VM, polling `localhost:26500` — Task 7 doesn't depend on this directly, but the end-to-end verification in this task is what proves Tasks 1-6 actually work together before exposing anything publicly.

Both job workers (`ClassifyFeedbackWorker`, `FileGithubIssueWorker`) run inside one Spring Boot process (`DocFeedbackTriageApplication`) — one systemd unit, not two.

- [ ] **Step 1: Build the jar locally and copy it to the VM**

From your local machine:
```bash
cd ~/projects/camunda/doc-feedback-triage-agent/worker
mvn -DskipTests package
scp -i ~/.ssh/doc-feedback-vm.key target/doc-feedback-triage-agent-0.1.0.jar \
  ubuntu@<VM_PUBLIC_IP>:/tmp/
```

- [ ] **Step 2: Set up the deploy directory and env file on the VM**

Run on the VM:
```bash
sudo mkdir -p /opt/doc-feedback-workers
sudo mv /tmp/doc-feedback-triage-agent-0.1.0.jar /opt/doc-feedback-workers/app.jar
sudo tee /opt/doc-feedback-workers/.env > /dev/null <<EOF
ANTHROPIC_API_KEY=<paste from worker/.env locally — Claude Haiku 4.5 key>
DOC_FEEDBACK_GITHUB_TOKEN=<paste from worker/.env locally — fine-grained PAT for pcimring/docs-feedback-demo>
CAMUNDA_USERNAME=demo
CAMUNDA_PASSWORD=<the CAMUNDA_DEMO_PASSWORD generated in Task 5, Step 3>
EOF
sudo chmod 600 /opt/doc-feedback-workers/.env
sudo useradd --system --no-create-home --shell /usr/sbin/nologin docfeedback
sudo chown -R docfeedback:docfeedback /opt/doc-feedback-workers
```

- [ ] **Step 3: Write `infra/worker/doc-feedback-workers.service`**

```ini
[Unit]
Description=doc-feedback-triage job workers (classify-feedback, file-github-issue)
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=docfeedback
Group=docfeedback
WorkingDirectory=/opt/doc-feedback-workers
ExecStart=/usr/bin/java -jar /opt/doc-feedback-workers/app.jar
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

`WorkingDirectory=/opt/doc-feedback-workers` matters: `DocFeedbackTriageApplication.loadDotEnv()` reads `.env` from the process's current working directory (`Path.of(".env")`), not relative to the jar — this is what makes the `.env` from Step 2 actually get picked up.

- [ ] **Step 4: Install Java, copy the unit file, start the service**

Run on the VM: `sudo apt-get install -y openjdk-21-jre-headless`

From your local machine, copy the unit file written in Step 3:
```bash
scp -i ~/.ssh/doc-feedback-vm.key \
  ~/projects/camunda/doc-feedback-triage-online-demo/infra/worker/doc-feedback-workers.service \
  ubuntu@<VM_PUBLIC_IP>:/tmp/
```
Then on the VM:
```bash
sudo cp /tmp/doc-feedback-workers.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now doc-feedback-workers
sudo systemctl status doc-feedback-workers
```
Expected: `active (running)`, and `journalctl -u doc-feedback-workers -f` shows both workers registering with Zeebe without auth errors (confirms Task 1's config change + Step 2's `.env` are wired correctly).

- [ ] **Step 5: End-to-end verification — spam path**

Run on the VM:
```bash
curl -u "demo:${CAMUNDA_DEMO_PASSWORD}" -X POST http://localhost:8080/v2/process-instances \
  -H 'Content-Type: application/json' \
  -d '{"processDefinitionId": "doc-feedback-triage", "variables": {"page": "docs/test.md", "comment": "buy cheap watches now click here"}}'
```
Expected: `200`, response includes a `processInstanceKey`. Wait ~5-10s, then:
```bash
curl -u "demo:${CAMUNDA_DEMO_PASSWORD}" http://localhost:8080/v2/process-instances/<processInstanceKey>
```
Expected: `"state": "COMPLETED"` — this comment should classify as spam and reach the Discarded end event automatically, no GitHub issue filed. Confirm no new issue appeared in `pcimring/docs-feedback-demo`.

- [ ] **Step 6: End-to-end verification — non-spam path through to a filed issue**

```bash
curl -u "demo:${CAMUNDA_DEMO_PASSWORD}" -X POST http://localhost:8080/v2/process-instances \
  -H 'Content-Type: application/json' \
  -d '{"processDefinitionId": "doc-feedback-triage", "variables": {"page": "docs/kubernetes/helm-values.md", "comment": "The helm install command in this doc is missing the --namespace flag"}}'
```
Note the `processInstanceKey`. Wait ~5-10s (for classification), then find the pending review task:
```bash
curl -u "demo:${CAMUNDA_DEMO_PASSWORD}" -X POST http://localhost:8080/v2/user-tasks/search \
  -H 'Content-Type: application/json' \
  -d '{"filter": {"processInstanceKey": "<processInstanceKey>", "state": "CREATED"}}'
```
Expected: one item, note its `userTaskKey`. Complete it:
```bash
curl -u "demo:${CAMUNDA_DEMO_PASSWORD}" -X POST http://localhost:8080/v2/user-tasks/<userTaskKey>/completion \
  -H 'Content-Type: application/json' -d '{}'
```
Expected: `204`. Wait a few seconds, then confirm completion and that a real issue was filed:
```bash
curl -u "demo:${CAMUNDA_DEMO_PASSWORD}" http://localhost:8080/v2/process-instances/<processInstanceKey>
```
Expected: `"state": "COMPLETED"`. Check `https://github.com/pcimring/docs-feedback-demo/issues` for a new issue titled `[docs-gap] ...` (or `bug`/`question`, whatever Claude classified it as) referencing the helm-values.md comment.

- [ ] **Step 7: Commit the systemd unit template and push everything from Tasks 1-6**

```bash
cd ~/projects/camunda/doc-feedback-triage-online-demo
git add infra/camunda/docker-compose.yaml infra/camunda/configuration infra/worker/doc-feedback-workers.service
git commit -m "Add Camunda docker-compose deploy and worker systemd unit for the online-demo VM"
git push

cd ~/projects/camunda/doc-feedback-triage-agent
git push   # Task 1's commit, plus the two pre-existing orphaned local commits
```

---

### Task 7: Cloudflare Tunnel for public HTTPS

**Manual account setup, then agent/human-executable commands.** Requires a Cloudflare account with a domain on it — use `petercimring.space` (per existing memory of that domain's purpose) or any domain already on Cloudflare.

**Files:**
- Create: `infra/cloudflared/config.yml` (committed as a template — the actual credentials file it references stays on the VM only)

**Interfaces:**
- Consumes: Camunda listening on `localhost:8080` from Task 5.
- Produces: `https://<chosen-subdomain>/` publicly reachable, proxying to the VM's Camunda REST API — the frontend plan's proxy targets this URL as `CAMUNDA_REST_URL`.

- [ ] **Step 1: Add the domain to Cloudflare (if not already) and create the tunnel**

In the Cloudflare dashboard: Zero Trust → Networks → Tunnels → Create a tunnel → Cloudflared → name it `doc-feedback-online-demo`. The dashboard gives you a one-line install+run command with a token — don't run that directly; instead note the tunnel token, since Step 3 runs `cloudflared` as a systemd service for durability across reboots rather than the dashboard's ad-hoc command.

- [ ] **Step 2: Install `cloudflared` on the VM**

Run on the VM:
```bash
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
sudo dpkg -i cloudflared.deb
cloudflared --version
```

- [ ] **Step 3: Write `infra/cloudflared/config.yml` and set it up as a service**

```yaml
tunnel: <tunnel-id-from-dashboard>
credentials-file: /etc/cloudflared/<tunnel-id>.json

ingress:
  - hostname: camunda-api.petercimring.space
    service: http://localhost:8080
  - service: http_status:404
```

On the VM, after `scp`-ing this file over:
```bash
sudo mkdir -p /etc/cloudflared
sudo cp config.yml /etc/cloudflared/
sudo cloudflared service install <tunnel-token-from-dashboard>
sudo systemctl status cloudflared
```
(`cloudflared service install` writes the credentials file to `/etc/cloudflared/` itself and registers the systemd unit — no separate unit file to author here.)

- [ ] **Step 4: Point DNS at the tunnel**

In the Cloudflare dashboard, under the tunnel's "Public Hostname" tab (or DNS tab for the zone): add a CNAME for `camunda-api` pointing to `<tunnel-id>.cfargotunnel.com`, proxied (orange cloud on).

- [ ] **Step 5: Verify from outside the VM**

From your local machine (not the VM):
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://camunda-api.petercimring.space/v2/topology
```
Expected: `401` (auth still required, exactly like Task 5 Step 5's local check — the tunnel doesn't change the auth requirement).
```bash
curl -s -u "demo:${CAMUNDA_DEMO_PASSWORD}" https://camunda-api.petercimring.space/v2/topology
```
Expected: `200` with the topology JSON — confirms the full path (internet → Cloudflare → tunnel → VM → Camunda → auth check) works.

- [ ] **Step 6: Commit**

```bash
cd ~/projects/camunda/doc-feedback-triage-online-demo
git add infra/cloudflared/config.yml
git commit -m "Add Cloudflare Tunnel config for public HTTPS to the Camunda REST API"
git push
```

---

### Task 8: Write the "Creating your own online demo" runbook section

**Files:**
- Modify: `README.md` (the "Creating your own online demo" section stubbed in Task 2)

**Interfaces:** none — documentation only, closes out this plan.

- [ ] **Step 1: Replace the stub with a condensed runbook**

Write the section as a numbered summary of Tasks 3-7 (VM sizing/image, Docker install, Camunda compose deploy incl. the `unprotectedApi`/password rotation reasoning, worker systemd unit, Cloudflare Tunnel), each step linking back to this plan file (`docs/superpowers/plans/2026-08-13-backend-infra.md`) for exact commands rather than re-pasting them — keep the README itself scannable, not a second copy of the whole plan. Explicitly call out the "gRPC never leaves the VM, only REST goes through the tunnel, no inbound firewall ports beyond SSH" security shape as the thing a reader should reproduce if adapting this for their own project.

- [ ] **Step 2: Commit and push**

```bash
cd ~/projects/camunda/doc-feedback-triage-online-demo
git add README.md
git commit -m "Write the 'creating your own online demo' runbook section"
git push
```

---

## What this plan does not cover

The frontend/proxy (Vercel app, status polling, review UI, rate limiting) is a separate plan — `2026-08-13-frontend-proxy.md` — which depends on this plan's `CAMUNDA_REST_URL` (Task 7 output) and `CAMUNDA_DEMO_PASSWORD` (Task 5 output) as its Vercel environment variables. Publishing the resulting link anywhere is explicitly out of scope for both plans, per the spec's rollout gate on the pending Camunda license.
