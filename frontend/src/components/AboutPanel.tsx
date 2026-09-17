export default function AboutPanel() {
  return (
    <div className="about-panel">
      <p>
        This live demo illustrates a simplified, end-to-end BPMN process for handling feedback
        on developer documentation: the kind of process that might run after a reader clicks
        &quot;submit&quot; on a feedback widget. Camunda orchestrates the process: an LLM
        classifies the feedback, a human reviewer confirms or overrides that classification,
        and a Java worker files a real GitHub issue once approved.
      </p>
      <p>For more context, as well as the source code, see:</p>
      <ul>
        <li>
          <strong>GitHub repo:</strong>{" "}
          <a href="https://github.com/pcimring/doc-feedback-triage-agent" target="_blank" rel="noreferrer">
            doc-feedback-triage-agent
          </a>{" "}
          - the BPMN process, Java workers, and Camunda deployment
        </li>
        <li>
          <strong>GitHub repo:</strong>{" "}
          <a
            href="https://github.com/pcimring/doc-feedback-triage-online-demo"
            target="_blank"
            rel="noreferrer"
          >
            doc-feedback-triage-online-demo
          </a>{" "}
          - this site&apos;s frontend and infra
        </li>
        <li>
          <a href="https://pcimring.github.io" target="_blank" rel="noreferrer">
            Portfolio
          </a>{" "}
          - more of Peter Cimring&apos;s work with Camunda, BPMN, and AI orchestration
        </li>
      </ul>
    </div>
  );
}
