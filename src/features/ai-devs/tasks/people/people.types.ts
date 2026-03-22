export interface Person {
  name: string
  surname: string
  gender: string
  birthDate: string
  birthPlace: string
  birthCountry: string
  job: string
}

export interface TaggedPerson {
  name: string
  surname: string
  gender: string
  born: number // YYYY
  city: string
  tags: string[]
}

export interface TaggingResult {
  id: number
  tags: string[]
}
