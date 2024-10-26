export function createXLSBlob(data: ArrayBuffer) {
  return new Blob([data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8',
  })
}

export function createFileURL(data: MediaSource | Blob) {
  return URL.createObjectURL(data)
}

export function makeDownloadFileByUrl(filename: string) {
  return (url: string) => {
    const a = document.createElement('a')
    a.setAttribute('href', url)
    a.setAttribute('download', filename)
    a.click()
  }
}
