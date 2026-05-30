import { Circle, KeyRound, Power, Route, ShieldCheck, Wallet } from "lucide-react";
import type { TransactionIntent } from "../types";
import { formatLabel } from "../utils/format";
import { StateLine } from "./StateLine";

export function TransactionPanel({
  intent,
  onAdvance,
  onPrepareSolana,
  onReset,
  preparingSolana,
}: {
  intent: TransactionIntent;
  onAdvance: () => void;
  onPrepareSolana?: () => void;
  onReset: () => void;
  preparingSolana?: boolean;
}) {
  const canAdvance = intent.status !== "DRAFT" && intent.status !== "CONFIRMED" && intent.status !== "FAILED";
  const actionLabel = intent.status === "CONFIRMED" ? "Confirmed" : "Simulate Next Step";

  return (
    <section className="side-panel transaction-panel">
      <div className="panel-title">
        <Wallet size={18} />
        <strong>Transaction Preview</strong>
      </div>
      <strong className="intent-title">{intent.title}</strong>
      <div className="state-lines">
        <StateLine label="Chain" value={`${intent.chain} / ${intent.network}`} />
        <StateLine label="Status" value={formatLabel(intent.status)} />
        <StateLine label="Mode" value={formatLabel(intent.executionMode)} />
        {intent.inputToken && <StateLine label="Input" value={`${intent.amount ?? ""} ${intent.inputToken}`.trim()} />}
        {intent.outputToken && <StateLine label="Output" value={intent.outputToken} />}
        {intent.slippage && <StateLine label="Slippage" value={intent.slippage} />}
        {intent.estimatedFees && <StateLine label="Fees" value={intent.estimatedFees} />}
      </div>

      <section className="transaction-subsection">
        <div className="panel-title">
          <Route size={16} />
          <strong>Lifecycle</strong>
        </div>
        <div className="lifecycle-list">
          {intent.lifecycle.map((step) => (
            <div className={`lifecycle-step ${step.status.toLowerCase()}`} key={step.id}>
              <Circle size={10} />
              <span>{step.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="transaction-subsection">
        <div className="panel-title">
          <KeyRound size={16} />
          <strong>Programs</strong>
        </div>
        <div className="reference-list">
          {intent.programs.map((program) => (
            <ReferenceLine key={`${program.label}-${program.address}`} label={program.label} value={program.address} />
          ))}
        </div>
      </section>

      <section className="transaction-subsection">
        <div className="panel-title">
          <Wallet size={16} />
          <strong>Accounts</strong>
        </div>
        <div className="reference-list">
          {intent.accounts.map((account) => (
            <ReferenceLine
              key={`${account.label}-${account.address ?? "pending"}`}
              label={`${account.label}${account.signer ? " signer" : ""}`}
              value={account.address ?? "Pending wallet"}
            />
          ))}
        </div>
      </section>

      {intent.preparedSolanaTransaction && (
        <section className="transaction-subsection prepared-transaction">
          <div className="panel-title">
            <Route size={16} />
            <strong>Prepared Solana Action</strong>
          </div>
          <StateLine label="Action" value={formatLabel(intent.preparedSolanaTransaction.action)} />
          <StateLine label="Instruction" value={intent.preparedSolanaTransaction.instructions[0].instructionName} />
          <StateLine label="Fee payer" value={shorten(intent.preparedSolanaTransaction.feePayer)} />
          {intent.preparedSolanaTransaction.amountBaseUnits && (
            <StateLine label="Base units" value={intent.preparedSolanaTransaction.amountBaseUnits} />
          )}
          <ReferenceLine
            label="Data"
            value={intent.preparedSolanaTransaction.instructions[0].dataHex}
          />
          {intent.preparedSolanaTransaction.warnings.map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </section>
      )}

      {intent.solanaBoundary && (
        <section className={`transaction-subsection solana-boundary ${intent.solanaBoundary.status.toLowerCase()}`}>
          <div className="panel-title">
            <ShieldCheck size={16} />
            <strong>Wallet Boundary</strong>
          </div>
          <StateLine label="Boundary" value={formatLabel(intent.solanaBoundary.status)} />
          {intent.solanaBoundary.recentBlockhash && (
            <StateLine label="Blockhash" value={shorten(intent.solanaBoundary.recentBlockhash)} />
          )}
          <StateLine label="Instructions" value={intent.solanaBoundary.instructionCount.toString()} />
          <StateLine label="Signers" value={intent.solanaBoundary.requiredSigners.length.toString()} />
          {intent.solanaBoundary.unitsConsumed && (
            <StateLine label="Units" value={intent.solanaBoundary.unitsConsumed.toLocaleString()} />
          )}
          <span>{intent.solanaBoundary.message}</span>
          {intent.solanaBoundary.simulationError && <span>{intent.solanaBoundary.simulationError}</span>}
          {intent.solanaBoundary.simulationLogs.length > 0 && (
            <div className="simulation-log-list">
              {intent.solanaBoundary.simulationLogs.slice(-4).map((log) => (
                <code key={log}>{shorten(log)}</code>
              ))}
            </div>
          )}
        </section>
      )}

      {intent.acknowledgement && (
        <section className="transaction-subsection acknowledgement-summary">
          <div className="panel-title">
            <ShieldCheck size={16} />
            <strong>Disclosure</strong>
          </div>
          <span>{intent.acknowledgement.label}</span>
          <strong>{intent.acknowledgement.accepted ? "Acknowledged" : "Review Required"}</strong>
        </section>
      )}

      <p>{intent.signaturePolicy}</p>
      <p>{intent.riskSummary}</p>
      <p>{intent.expectedResult}</p>
      <div className="transaction-actions">
        {intent.preparedSolanaTransaction && onPrepareSolana && (
          <button className="secondary-action" disabled={preparingSolana} onClick={onPrepareSolana}>
            <ShieldCheck size={16} />
            {preparingSolana ? "Checking Boundary" : "Run Wallet Simulation"}
          </button>
        )}
        <button className="primary-action" disabled={!canAdvance} onClick={onAdvance}>
          <Power size={16} />
          {actionLabel}
        </button>
        <button className="secondary-action" disabled={intent.status === "DRAFT"} onClick={onReset}>
          Reset Preview
        </button>
      </div>
    </section>
  );
}

function ReferenceLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="reference-line">
      <span>{label}</span>
      <code>{shorten(value)}</code>
    </div>
  );
}

function shorten(value: string) {
  if (value.length <= 22 || value.includes("pending") || value.includes(":")) return value;
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}
