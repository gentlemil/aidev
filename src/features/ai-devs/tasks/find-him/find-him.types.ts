/* eslint-disable @typescript-eslint/no-explicit-any */
export interface LocationsResponse {
  power_plants: {
    [key: string]: Omit<PowerPlant, 'city'>
  }
}

export interface PowerPlant {
  city: string
  latitude?: number
  longitude?: number
  is_active: boolean
  power: string
  code: string
}

export interface Suspect {
  name: string
  surname: string
  born: number
}

export interface SuspectLocation {
  name: string
  surname: string
  locations: { latitude: number; longitude: number }[]
}

export interface FindHimAnswer {
  name: string
  surname: string
  accessLevel: number
  powerPlant: string
}

export interface ToolDispatcher {
  get_power_plants: () => Promise<any>
  get_survivor_locations: (args: { name: string; surname: string }) => Promise<any>
  check_access_level: (args: { name: string; surname: string; birthYear: number }) => Promise<any>
  calculate_distance: (args: { lat1: number; lon1: number; lat2: number; lon2: number }) => { distanceKm: number }
  submit_answer: (answer: FindHimAnswer) => Promise<any>
}
