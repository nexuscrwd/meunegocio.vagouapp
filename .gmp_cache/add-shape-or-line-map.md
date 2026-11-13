# Add a Shape or Line to a Map

You can draw geographical overlays tied to latitude and longitude coordinates on
a map using the `maps` library. The Maps JavaScript API provides four primary
shape classes:

-   **`Polyline`**: A linear overlay of connected line segments defined by an
    ordered sequence of `LatLng` coordinates.
-   **`Polygon`**: An enclosed area (closed loop) defined by one or more
    sequences of `LatLng` coordinates, supporting strokes, fills, and inner
    holes.
-   **`Rectangle`**: A rectangular overlay defined by a `LatLngBounds` object
    (`north`, `south`, `east`, `west`).
-   **`Circle`**: A circular overlay defined by a center `LatLng` and a `radius`
    in meters.

All shapes support custom hexadecimal stroke/fill colors (`"#RRGGBB"` — named
HTML colors are not supported), opacities (`0.0` to `1.0`), stroke weights in
pixels, and user interaction via `editable` and `draggable` properties.

--------------------------------------------------------------------------------

## Prerequisites

Ensure you have an initialized map on your page (either via `<gmp-map>` web
component or `google.maps.Map`) and have loaded the Maps JavaScript API using
the dynamic library import bootstrap.

--------------------------------------------------------------------------------

## 1. Polylines

A `Polyline` connects an array of `LatLng` or `LatLngLiteral` coordinates in an
ordered sequence.

### Add a Polyline

Import `Polyline` from the `maps` library, instantiate it with
`PolylineOptions`, and attach it to your map instance using `setMap()` or the
`map` option.

#### HTML (Web Component Setup)

```html
<gmp-map
  center="0, -180"
  zoom="3"
  map-id="DEMO_MAP_ID"
  internal-usage-attribution-ids="gmp_git_agentskills_v1"
></gmp-map>
```

#### TypeScript / JavaScript

```typescript
const mapElement = document.querySelector('gmp-map')!;

async function init() {
  const { Polyline } = (await google.maps.importLibrary('maps')) as google.maps.MapsLibrary;
  const innerMap = mapElement.innerMap;

  const flightPlanCoordinates: google.maps.LatLngLiteral[] = [
    { lat: 37.772, lng: -122.214 },
    { lat: 21.291, lng: -157.821 },
    { lat: -18.142, lng: 178.431 },
    { lat: -27.467, lng: 153.027 },
  ];

  const flightPath = new Polyline({
    path: flightPlanCoordinates,
    geodesic: true,
    strokeColor: '#FF0000',
    strokeOpacity: 1.0,
    strokeWeight: 2,
  });

  flightPath.setMap(innerMap);
}

void init();
```

### Inspect and Modify a Polyline (`MVCArray`)

Calling `polyline.getPath()` returns an `MVCArray<LatLng>`.

> **Important:** You cannot index an `MVCArray` using bracket notation
> (`mvcArray[i]`). You must use `MVCArray` methods: - `getAt(i)`: Returns the
> `LatLng` at zero-based index `i`. - `insertAt(i, latLng)`: Inserts a `LatLng`
> at index `i`. - `removeAt(i)`: Removes the `LatLng` at index `i`. -
> `push(latLng)`: Appends a `LatLng` to the end of the path. - `getLength()`:
> Returns the number of vertices in the path.

```typescript
// Append a coordinate dynamically on map click
innerMap.addListener('click', (event: google.maps.MapMouseEvent) => {
  if (!event.latLng) return;
  const path = flightPath.getPath();
  path.push(event.latLng);
});
```

--------------------------------------------------------------------------------

## 2. Polygons

A `Polygon` defines an enclosed region with both stroke and fill properties.
Polygons automatically close their loop, so you do not need to repeat the
starting coordinate at the end of the array.

### Add a Simple Polygon

```typescript
async function initMap(): Promise<void> {
  const { Map, Polygon } = (await google.maps.importLibrary('maps')) as google.maps.MapsLibrary;

  const map = new Map(document.getElementById('map') as HTMLElement, {
    zoom: 5,
    center: { lat: 24.886, lng: -70.268 },
    mapTypeId: 'terrain',
    internalUsageAttributionIds: ['gmp_git_agentskills_v1'],
  });

  const triangleCoords: google.maps.LatLngLiteral[] = [
    { lat: 25.774, lng: -80.19 },
    { lat: 18.466, lng: -66.118 },
    { lat: 32.321, lng: -64.757 },
  ];

  const bermudaTriangle = new Polygon({
    paths: triangleCoords,
    strokeColor: '#FF0000',
    strokeOpacity: 0.8,
    strokeWeight: 2,
    fillColor: '#FF0000',
    fillOpacity: 0.35,
    map,
  });
}

void initMap();
```

### Put a Hole in a Polygon

To create a hole inside a polygon, pass an array of paths (`paths: [outerCoords,
innerCoords]`) where the inner path coordinates are wound in the **opposite
direction** (e.g., counter-clockwise if the outer path is clockwise).

> **Tip:** If you use the Maps Data Layer (`map.data`), it handles polygon
> winding order automatically.

```typescript
// Outer path (wound counter-clockwise)
const outerCoords = [
  { lat: 25.774, lng: -80.19 },
  { lat: 18.466, lng: -66.118 },
  { lat: 32.321, lng: -64.757 },
];

// Inner path (wound clockwise - opposite direction to form a hole)
const innerCoords = [
  { lat: 28.745, lng: -70.579 },
  { lat: 29.57, lng: -67.514 },
  { lat: 27.339, lng: -66.668 },
];

const polygonWithHole = new Polygon({
  paths: [outerCoords, innerCoords],
  strokeColor: '#FFC107',
  strokeOpacity: 0.8,
  strokeWeight: 2,
  fillColor: '#FFC107',
  fillOpacity: 0.35,
  map,
});
```

### Inspect a Polygon

-   For a single-path polygon, call `polygon.getPath()` to get the
    `MVCArray<LatLng>`.
-   For a multi-path polygon, call `polygon.getPaths()` to get an
    `MVCArray<MVCArray<LatLng>>`.

```typescript
const vertices = bermudaTriangle.getPath();
for (let i = 0; i < vertices.getLength(); i++) {
  const xy = vertices.getAt(i);
  console.log(`Coordinate ${i}: ${xy.lat()}, ${xy.lng()}`);
}
```

--------------------------------------------------------------------------------

## 3. Rectangles

Use `Rectangle` to draw a rectangular region defined by a `bounds`
(`google.maps.LatLngBounds` or `google.maps.LatLngBoundsLiteral`).

```typescript
async function initMap(): Promise<void> {
  const { Map, Rectangle } = (await google.maps.importLibrary('maps')) as google.maps.MapsLibrary;

  const map = new Map(document.getElementById('map') as HTMLElement, {
    zoom: 11,
    center: { lat: 33.678, lng: -116.243 },
    mapTypeId: 'terrain',
    internalUsageAttributionIds: ['gmp_git_agentskills_v1'],
  });

  const rectangle = new Rectangle({
    strokeColor: '#FF0000',
    strokeOpacity: 0.8,
    strokeWeight: 2,
    fillColor: '#FF0000',
    fillOpacity: 0.35,
    map,
    bounds: {
      north: 33.685,
      south: 33.671,
      east: -116.234,
      west: -116.251,
    },
  });
}

void initMap();
```

You can also update a rectangle dynamically using `rectangle.setOptions({
bounds: ... })` or `rectangle.setBounds(...)`.

--------------------------------------------------------------------------------

## 4. Circles

Use `Circle` to draw a circular area around a `center` coordinate with a
`radius` specified in **meters**.

```typescript
const mapElement = document.querySelector('gmp-map')!;

async function init() {
  const { Circle } = (await google.maps.importLibrary('maps')) as google.maps.MapsLibrary;
  const innerMap = mapElement.innerMap;

  const walkingCircle = new Circle({
    strokeColor: '#ffdd00',
    strokeOpacity: 0.8,
    strokeWeight: 2,
    fillColor: '#ffdd00',
    fillOpacity: 0.35,
    map: innerMap,
    center: { lat: 34.989568, lng: 135.742399 },
    radius: 400, // 400 meters
    draggable: true,
    editable: false,
  });

  // Dynamically update center or radius
  // walkingCircle.setRadius(800);
  // walkingCircle.setCenter(newLatLng);
}

void init();
```

--------------------------------------------------------------------------------

## 5. Removing and Deleting Shapes

To remove any shape (`Polyline`, `Polygon`, `Rectangle`, or `Circle`) from the
map, call `setMap(null)`:

```typescript
// Hides the shape from the map (does not delete the instance)
shape.setMap(null);

// To completely delete the shape and reclaim memory, dereference it after removing:
shape = null;
```

For multiple shapes (such as in a dynamic layer or game), maintain an array of
active shape references and iterate over them during cleanup (adapted from
[samples/map-puzzle/index.ts](https://github.com/googlemaps/js-samples/blob/HEAD/samples/map-puzzle/index.ts?utm_campaign=gmp_git_agentskills_v1)):

```typescript
let polygons: google.maps.Polygon[] = [];

function clearPolygons() {
  for (const poly of polygons) {
    poly.setMap(null);
  }
  polygons = [];
}
```

--------------------------------------------------------------------------------

## 6. User-Editable and Draggable Shapes

All shapes can be made interactive in the UI by configuring their options:

-   **`editable: true`**: Adds control handles to the shape so users can
    reposition, reshape, and resize vertices/bounds directly on the map.
-   **`draggable: true`**: Allows users to drag the entire shape to a new
    location.
-   **`geodesic: true`**: Recommended when making `Polygon` or `Polyline` shapes
    draggable. A geodesic shape retains its true geographic area/shortest-path
    curvature on the Earth's sphere as it moves north or south across the
    Mercator projection.

> **Note:** User edits do not persist automatically across sessions. Listen to
> editing/dragging events to capture and store updated coordinates.

### Listening to Editing and Dragging Events

Shape           | Target Object for Listener        | Editing Events                     | Dragging Events (on Shape)
:-------------- | :-------------------------------- | :--------------------------------- | :-------------------------
**`Circle`**    | `circle` instance                 | `radius_changed`, `center_changed` | `dragstart`, `drag`, `dragend`
**`Rectangle`** | `rectangle` instance              | `bounds_changed`                   | `dragstart`, `drag`, `dragend`
**`Polyline`**  | `polyline.getPath()` (`MVCArray`) | `insert_at`, `remove_at`, `set_at` | `dragstart`, `drag`, `dragend`
**`Polygon`**   | Each path in `polygon.getPaths()` | `insert_at`, `remove_at`, `set_at` | `dragstart`, `drag`, `dragend`

#### Code Example: Handling Shape Edits and Drags

```typescript
// 1. Circle editing events
circle.addListener('radius_changed', () => {
  console.log('New radius (m):', circle.getRadius());
});

circle.addListener('center_changed', () => {
  console.log('New center:', circle.getCenter()?.toJSON());
});

// 2. Rectangle editing events
rectangle.addListener('bounds_changed', () => {
  console.log('New bounds:', rectangle.getBounds()?.toJSON());
});

// 3. Polyline / Polygon path vertex editing events
// Must be attached to the MVCArray path object, NOT the Polygon/Polyline instance directly
const path = polygon.getPath();
path.addListener('set_at', (index: number, previous: google.maps.LatLng) => {
  console.log(`Vertex ${index} moved to:`, path.getAt(index).toJSON());
});

path.addListener('insert_at', (index: number) => {
  console.log(`New vertex inserted at ${index}:`, path.getAt(index).toJSON());
});

path.addListener('remove_at', (index: number, removed: google.maps.LatLng) => {
  console.log(`Vertex removed at ${index}:`, removed.toJSON());
});

// 4. Dragging events (attached directly to the shape instance)
polygon.addListener('dragend', () => {
  console.log('Finished dragging polygon.');
});
```
