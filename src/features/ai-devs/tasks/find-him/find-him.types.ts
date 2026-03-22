export interface LocationsResponse {
  power_plants: {
    [key: string]: PowerPlant
  }
}

export interface PowerPlant {
  is_active: boolean
  power: string
  code: string
}

export interface Suspect {
  name: string
  surname: string
  born: number
}
