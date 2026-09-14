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

The demo is live: **https://doc-feedback-triage-online-demo.vercel.app**

Submit feedback on a (fictional) documentation page and watch it move
through classification, human review, and — if approved — a real GitHub
issue filed on the sandbox repo. Rate-limited per IP to keep it usable for
everyone.

## Creating your own online demo

<!-- Filled in by infra Task 8: the actual runbook — VM, Camunda, Cloudflare
     Tunnel, Vercel — for anyone who wants to stand up their own copy. -->

## Repo layout

- `infra/` — VM deploy config: Docker Compose (Camunda), systemd units
  (workers, Cloudflare Tunnel).
- `frontend/` — Vercel app: submission form, status polling, and the
  visitor-facing review UI, backed by a serverless proxy that holds Camunda
  credentials server-side.
