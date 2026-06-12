interface DebugResponseScreenProps {
  rawResponse: string;
  onContinue: () => void;
}

export default function DebugResponseScreen({ rawResponse, onContinue }: DebugResponseScreenProps) {
  let formatted = rawResponse;
  try {
    formatted = JSON.stringify(JSON.parse(rawResponse), null, 2);
  } catch {
    // fall back to raw text
  }

  return (
    <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ color: '#1E3A5F', marginBottom: '8px' }}>
        Raw Response from Orchestration Layer
      </h2>
      <p style={{ color: '#666', marginBottom: '16px', fontSize: '14px' }}>
        This is the exact JSON received. Review it to confirm the data looks correct before
        proceeding to the quote review screen.
      </p>
      <div
        style={{
          background: '#1E1E1E',
          borderRadius: '8px',
          padding: '16px',
          maxHeight: '500px',
          overflowY: 'auto' as const,
          marginBottom: '24px',
        }}
      >
        <pre
          style={{
            color: '#D4D4D4',
            fontSize: '12px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            margin: 0,
          }}
        >
          {formatted}
        </pre>
      </div>
      <button
        onClick={onContinue}
        style={{
          background: '#1E3A5F',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          padding: '14px 32px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: 'pointer',
        }}
      >
        Continue to Quote Review &rarr;
      </button>
    </div>
  );
}
