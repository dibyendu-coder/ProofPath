import type { ReportSnapshot } from './types';

export function ReportPreview({ snapshot }: { snapshot: ReportSnapshot }) {
  return (
    <div className="export-preview" aria-label="Final report preview">
      <header>
        <span>ProofPath / Investigation file</span>
        <h3>The investigation.</h3>
        <p>
          Report {snapshot.reportId} · Case {snapshot.caseId} · Source{' '}
          {snapshot.sourceType} · exported{' '}
          {new Date(snapshot.exportedAt).toLocaleString()}
        </p>
      </header>
      <section>
        <h4>Executive summary</h4>
        <p>{snapshot.summary}</p>
        <strong>
          {snapshot.risk.score} / 100 · {snapshot.risk.classification}
        </strong>
        <p>{snapshot.risk.explanation}</p>
      </section>
      <section>
        <h4>Investigation findings</h4>
        {snapshot.findings.length ? (
          snapshot.findings.map((finding) => (
            <article key={finding.id}>
              <h5>
                {finding.id} / {finding.title} · {finding.severity}
              </h5>
              <p>{finding.explanation}</p>
              {finding.quotation && (
                <blockquote>
                  <small>
                    {finding.quotationRedacted
                      ? 'Redacted quotation'
                      : 'Source quotation'}{' '}
                    / {finding.evidenceId}
                  </small>
                  {finding.quotation}
                </blockquote>
              )}
            </article>
          ))
        ) : (
          <p>
            No supported warning signs were retained. This is not a safety
            verdict.
          </p>
        )}
      </section>
      <section>
        <h4>Evidence register</h4>
        {snapshot.evidence.map((item) => (
          <p key={item.id}>
            <strong>
              {item.id} / {item.origin}
              {item.start !== null ? ` / Offset ${item.start}-${item.end}` : ''}
            </strong>
            <br />
            {item.quotationRedacted ? '[Redacted quotation] ' : ''}
            {item.quotation}
          </p>
        ))}
        {snapshot.evidence.length === 0 && <p>Evidence quotations excluded.</p>}
        <p>Extraction method: {snapshot.extractionMethod}</p>
        {snapshot.sourceUrl && <p>Source URL: {snapshot.sourceUrl}</p>}
        {snapshot.ocrWarnings.map((warning, i) => (
          <p key={i}>OCR warning: {warning}</p>
        ))}
      </section>
      {snapshot.reviewedSource && (
        <section>
          <h4>Reviewed source text</h4>
          <p className="export-preview__source">{snapshot.reviewedSource}</p>
        </section>
      )}
      {snapshot.graph && (
        <section>
          <h4>Evidence relationship map</h4>
          <p>Structured register of supported graph relationships.</p>
          <ol>
            {snapshot.graph.edges.map((edge, i) => {
              const from = snapshot.graph!.nodes.find(
                  (node) => node.id === edge.from,
                ),
                to = snapshot.graph!.nodes.find((node) => node.id === edge.to);
              return (
                <li key={i}>
                  {from?.title} → {edge.type.replaceAll('_', ' ')} → {to?.title}
                </li>
              );
            })}
          </ol>
        </section>
      )}
      <section>
        <h4>Verification plan</h4>
        <p>
          {snapshot.verification.completed} / {snapshot.verification.total}{' '}
          user-marked actions complete; {snapshot.verification.unresolvedHigh}{' '}
          unresolved high-priority concerns.
        </p>
        <ol>
          {snapshot.verification.actions.map((action) => (
            <li key={action.id}>
              <strong>{action.title}</strong> · {action.priority} ·{' '}
              {action.status.replaceAll('_', ' ')}
              <p>{action.method}</p>
              {action.notes?.map((note, i) => (
                <p key={i}>
                  User-reported {note.kind}: {note.text}
                  {note.referenceUrl ? ` / ${note.referenceUrl}` : ''}
                </p>
              ))}
            </li>
          ))}
        </ol>
      </section>
      {snapshot.verification.timeline && (
        <section>
          <h4>Investigation timeline</h4>
          <ol>
            {snapshot.verification.timeline.map((event, i) => (
              <li key={i}>
                <time dateTime={event.at}>
                  {new Date(event.at).toLocaleString()}
                </time>{' '}
                / {event.label}
              </li>
            ))}
          </ol>
        </section>
      )}
      <section>
        <h4>Investigation limitations</h4>
        <p>Missing information</p>
        <ul>
          {snapshot.missingInformation.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
        <p>Uncertainty</p>
        <ul>
          {snapshot.uncertaintyIndicators.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
        <p>Report limitations</p>
        <ul>
          {snapshot.limitations.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
        <p>Recommended checks</p>
        <ul>
          {snapshot.recommendedActions.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </section>
      <footer>
        <h4>Report metadata and disclaimer</h4>
        <p>
          Analysis {snapshot.analyzedAt} · Model {snapshot.model} · Schema{' '}
          {snapshot.schemaVersion}
        </p>
        {snapshot.fingerprint && (
          <p>
            SHA-256 payload fingerprint: <code>{snapshot.fingerprint}</code>
          </p>
        )}
        <p>{snapshot.disclaimer}</p>
      </footer>
    </div>
  );
}
