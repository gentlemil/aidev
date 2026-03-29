export interface City {
  name: string
  code: string
}

export interface Connection {
  itemCode: string
  cityCode: string
}

export interface Item {
  name: string
  code: string
}

export interface FilesData {
  cities: City[]
  connections: Connection[]
  items: Item[]
}

export interface ItemWithEmbedding {
  item: Item
  embedding: number[]
}

export interface ToolCallLog {
  ts: string
  params: string
  matchedItem: string | null
  output: string
}
