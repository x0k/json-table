export function createPage(content: string) {
  const win = window.open('')
  win?.document.write(content)
  return win
}
