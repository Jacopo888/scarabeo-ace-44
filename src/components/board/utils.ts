export const getSquareColor = (type: string) => {
  switch (type) {
    case 'TW': return 'bg-triple-word text-white'
    case 'DW': return 'bg-double-word text-white'
    case 'TL': return 'bg-triple-letter text-white'
    case 'DL': return 'bg-double-letter text-white'
    case 'STAR': return 'bg-star text-white'
    default: return 'bg-tile border-board-border'
  }
}

export const getSquareText = (type: string) => {
  switch (type) {
    case 'TW': return '3W'
    case 'DW': return '2W'
    case 'TL': return '3L'
    case 'DL': return '2L'
    case 'STAR': return '★'
    default: return ''
  }
}
