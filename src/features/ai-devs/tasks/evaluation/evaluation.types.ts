export interface Sensor {
  sensor_type: string
  timestamp: number
  temperature_K: number
  pressure_bar: number
  water_level_meters: number
  voltage_supply_v: number
  humidity_percent: number
  operator_notes: string
}

export type SensorEntry = { id: string; sensor: Sensor }
