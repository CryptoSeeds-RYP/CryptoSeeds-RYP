export function LoadingShell() {
  return (
    <main className="app-shell loading-shell">
      <section className="loading-panel">
        <img src="/assets/cryptoseeds-logo.png" alt="CryptoSeeds logo" />
        <strong>Loading CryptoSeeds protocol state</strong>
        <span>Preparing wallet, staking, project, harvest, governance, and SeedBot adapters.</span>
      </section>
    </main>
  );
}

