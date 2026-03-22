/**
 * Parse a single CSV line into an array of field values.
 * Handles:
 *  - Quoted fields that contain commas:  "Engineer, Backend"
 *  - Escaped double-quotes inside quotes: "He said ""hello"""
 *  - Unquoted fields (trimmed)
 */
function parseFields(line: string): string[] {
  const fields: string[] = []
  let pos = 0

  while (pos <= line.length) {
    if (line[pos] === '"') {
      // Quoted field — collect until the closing unescaped quote
      pos++ // skip opening quote
      let field = ''

      while (pos < line.length) {
        if (line[pos] === '"') {
          if (line[pos + 1] === '"') {
            // Escaped quote inside the field
            field += '"'
            pos += 2
          } else {
            // Closing quote
            pos++
            break
          }
        } else {
          field += line[pos]
          pos++
        }
      }

      fields.push(field)

      // Skip the delimiter (or we've reached end of line)
      if (line[pos] === ',') pos++
    } else {
      // Unquoted field — read until next comma or end of line
      const end = line.indexOf(',', pos)

      if (end === -1) {
        fields.push(line.slice(pos).trim())
        break
      } else {
        fields.push(line.slice(pos, end).trim())
        pos = end + 1
      }
    }
  }

  return fields
}

/**
 * Parse a CSV string into typed objects.
 *
 * @param raw     - Raw CSV text (supports both LF and CRLF line endings)
 * @param mapRow  - Transforms a key→value record into the target type T
 */
export function parseCSV<T>(raw: string, mapRow: (record: Record<string, string>) => T): T[] {
  // Normalise Windows line endings before splitting
  const lines = raw.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  if (lines.length < 2) return []

  const headers = parseFields(lines[0])

  return lines.slice(1).map((line) => {
    const values = parseFields(line)
    const record: Record<string, string> = {}

    headers.forEach((header, index) => {
      record[header] = values[index] ?? ''
    })

    return mapRow(record)
  })
}
