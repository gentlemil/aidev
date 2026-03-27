import { Sensor } from './evaluation.types'

// Check if sensor's data is valid based on its type
export function isValidSensorByType(sensor: Sensor): boolean {
  const types: string[] = sensor.sensor_type
    .split('/')
    .map((type: string) => type.trim().toLowerCase())

  // Active sensor must have non-zero value
  if (types.includes('pressure') && sensor.pressure_bar === 0) return false
  if (types.includes('voltage') && sensor.voltage_supply_v === 0) return false
  if (types.includes('temperature') && sensor.temperature_K === 0) return false
  if (types.includes('water') && sensor.water_level_meters === 0) return false
  if (types.includes('humidity') && sensor.humidity_percent === 0) return false

  // Inactive sensor must have zero value
  if (!types.includes('pressure') && sensor.pressure_bar !== 0) return false
  if (!types.includes('voltage') && sensor.voltage_supply_v !== 0) return false
  if (!types.includes('temperature') && sensor.temperature_K !== 0) return false
  if (!types.includes('water') && sensor.water_level_meters !== 0) return false
  if (!types.includes('humidity') && sensor.humidity_percent !== 0) return false

  return true
}

export function filterSensorsByTypeAndData(sensors: Sensor[]): Sensor[] {
  return sensors.filter(isValidSensorByType)
}

// Returns true if ALL active sensor values are within acceptable range (valid).
// Returns false immediately if ANY active value is out of range (anomaly).
export function isValidSensorByParameters(sensor: Sensor): boolean {
  const types: string[] = sensor.sensor_type
    .split('/')
    .map((type: string) => type.trim().toLowerCase())

  if (types.includes('pressure') && (sensor.pressure_bar < 60 || sensor.pressure_bar > 160))
    return false
  if (types.includes('voltage') && (sensor.voltage_supply_v < 229 || sensor.voltage_supply_v > 231))
    return false
  if (types.includes('temperature') && (sensor.temperature_K < 553 || sensor.temperature_K > 873))
    return false
  if (types.includes('water') && (sensor.water_level_meters < 5 || sensor.water_level_meters > 15))
    return false
  if (types.includes('humidity') && (sensor.humidity_percent < 40 || sensor.humidity_percent > 80))
    return false

  return true
}

export function filterSensorsByParameters(sensors: Sensor[]): Sensor[] {
  return sensors.filter(isValidSensorByParameters)
}
