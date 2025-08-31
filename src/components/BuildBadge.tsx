export function BuildBadge() {
  const buildTime = new Date().toISOString().substring(0, 16); // YYYY-MM-DDTHH:mm
  
  return (
    <div style={{
      position: 'fixed',
      bottom: 8,
      right: 8,
      opacity: 0.7,
      fontSize: 12,
      background: '#000',
      color: '#fff',
      padding: '4px 8px',
      borderRadius: 8,
      zIndex: 9999
    }}>
      v: {import.meta.env.MODE}-{buildTime}
    </div>
  );
}