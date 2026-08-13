"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { pickRandomSample } from "@/lib/samples";

export default function HomePage() {
  const [page, setPage] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  function handleFillSample() {
    const sample = pickRandomSample();
    setPage(sample.page);
    setComment(sample.comment);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, comment }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Something went wrong. Try again.");
        setSubmitting(false);
        return;
      }
      const { processInstanceKey } = await res.json();
      router.push(`/review/${processInstanceKey}`);
    } catch {
      setError("Something went wrong. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <main>
      <h1>doc-feedback-triage: live demo</h1>
      <p>
        Submit feedback on a (fictional) documentation page and watch it move through
        classification, human review, and, if approved, a real filed GitHub issue.
      </p>
      <form onSubmit={handleSubmit}>
        <label>
          Page
          <input
            value={page}
            onChange={(e) => setPage(e.target.value)}
            placeholder="docs/kubernetes/helm-values.md"
            required
          />
        </label>
        <label>
          Comment
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="The helm install command in this doc is missing the --namespace flag"
            required
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="secondary" onClick={handleFillSample}>
            Fill in sample values
          </button>
          <button type="submit" disabled={submitting}>
            {submitting ? "Starting..." : "Submit feedback"}
          </button>
        </div>
      </form>
    </main>
  );
}
