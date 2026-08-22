declare module 'leaflet.heat' {
  import * as L from 'leaflet'

  export interface HeatLatLngTuple extends Array<number> {
    0: number
    1: number
    2?: number
  }

  export interface HeatMapOptions {
    minOpacity?: number
    maxZoom?: number
    max?: number
    radius?: number
    blur?: number
    gradient?: { [key: number]: string }
  }

  export function heatLayer(
    latlngs: Array<HeatLatLngTuple | L.LatLng>,
    options?: HeatMapOptions
  ): L.Layer
}
