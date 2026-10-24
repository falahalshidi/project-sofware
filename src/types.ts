export type Place = { id: string; name: string; country?: string; admin1?: string; latitude: number; longitude: number; timezone?: string }
export type WeatherData = {
  timezone: string; current: Record<string, number | string | boolean>; hourly: Record<string, Array<number | string>>; daily: Record<string, Array<number | string>>
}
