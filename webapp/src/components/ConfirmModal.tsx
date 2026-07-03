export function ConfirmModal({
  message,
  confirmLabel,
  onConfirm,
  onCancel
}: {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal-card" role="alertdialog" aria-labelledby="confirm-modal-title">
        <h3 id="confirm-modal-title">Start over?</h3>
        <p>{message}</p>
        <div className="modal-actions">
          <button type="button" className="danger-button" onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button type="button" className="text-button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
