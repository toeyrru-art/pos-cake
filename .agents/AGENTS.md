# Project Rules

## Popups and Modals
- **Always use React Portal**: Whenever creating a popup or modal component in React, ALWAYS use `createPortal(<ModalContent />, document.body)` to ensure it sits above all other elements and avoids stacking context issues (e.g. from `transform` or `animation`).
- **Premium Styling**: Use the defined CSS classes for popups (`.modal-overlay`, `.modal-content`, `.modal-header`, `.premium-input`).
- **Visibility**: Ensure that input fields inside modals have a solid background (or appropriate color) so that text is clearly visible and does not sink into the glassmorphism backdrop.
