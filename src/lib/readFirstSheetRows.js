import {ExcelReader} from 'excel-bridge'

const reader = new ExcelReader()

const cellValue = (cell) =>
  !cell || cell.type === 'empty' ? null : cell.value

// Reads the first sheet of an .xlsx file as rows of plain values.
// Rows without any value are skipped; missing cells become null.
export default async function readFirstSheetRows(file) {
  if (!/\.xlsx$/i.test(file.name)) {
    throw new Error('Only .xlsx files are supported')
  }
  const workbook = await reader.parseFromFile(file)
  const sheet = workbook.sheets[0]
  if (!sheet) return []

  const rows = []
  for (const row of sheet.data) {
    if (!row) continue
    const values = Array.from(row, cellValue)
    if (values.some((value) => value !== null && value !== '')) {
      rows.push(values)
    }
  }
  return rows
}
