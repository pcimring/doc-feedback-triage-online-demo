"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { RunStatus } from "@/lib/status";

const POLL_INTERVAL_MS = 2000;
const TERMINAL_STAGES = new Set(["discarded", "filed"]);

export default function ReviewPage() {
  const { processInstanceKey } = useParams<{ processInstanceKey: string }>();
  const [status, setStatus] = useState<RunStatus | null>(null);
  const [category, setCategory] = useState("");
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    let stopped = false;
    let intervalId: ReturnType<typeof setInterval>;

    async function poll() {
      const res = await fetch(`/api/runs/${processInstanceKey}`);
      if (!res.ok || stopped) return;
      const data: RunStatus = await res.json();
      if (stopped) return;
      setStatus(data);
      if (data.stage === "pending_review") {
        setCategory((current) => current || data.category);
      }
      if (TERMINAL_STAGES.has(data.stage)) {
        clearInterval(intervalId);
      }
    }

    poll();
    intervalId = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      clearInterval(intervalId);
    };
  }, [processInstanceKey]);

  async function handleComplete() {
    if (status?.stage !== "pending_review") return;
    setCompleting(true);
    await fetch(`/api/tasks/${status.userTaskKey}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category }),
    });
    setCompleting(false);
  }

  if (!status || status.stage === "processing") {
    return <p>Classifying feedback...</p>;
  }

  if (status.stage === "pending_review") {
    return (
      <main>
        <h1>Review classification</h1>
        <p>Page: {status.page}</p>
        <p>Comment: {status.comment}</p>
        <p>
          Claude classified this as <strong>{status.category}</strong> (
          {Math.round(status.confidence * 100)}% confidence): {status.summary}
        </p>
        <label>
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="bug">bug</option>
            <option value="docs-gap">docs-gap</option>
            <option value="question">question</option>
            <option value="spam">spam</option>
          </select>
        </label>
        <button onClick={handleComplete} disabled={completing}>
          {completing ? "Filing..." : "Confirm and file issue"}
        </button>
      </main>
    );
  }

  if (status.stage === "discarded") {
    return <p>Classified as spam and discarded automatically. No issue filed.</p>;
  }

  return (
    <p>
      Issue filed: <a href={status.issueUrl}>{status.issueUrl}</a>
    </p>
  );
}
