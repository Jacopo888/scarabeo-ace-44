// Small helper to decide toast title for confirmMove errors
export function titleForConfirmError(errorCode?: string): string {
  switch (errorCode) {
    case 'empty':
      return 'Error'
    case 'invalid_move':
      return 'Invalid move'
    default:
      return 'Invalid words'
  }
}
