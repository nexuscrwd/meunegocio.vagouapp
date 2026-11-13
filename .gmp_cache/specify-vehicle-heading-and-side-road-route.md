# Specify Vehicle Heading and Side of Road for a Route

Waypoints in the Routes API support location modifiers that control how a
vehicle approaches or stops at a location. Specifically, you can specify the
vehicle's `heading` (compass direction) or its `sideOfRoad` preference. This
ensures that a vehicle arrives on the same side of the road as a passenger
waiting to be picked up or a delivery drop-off point.

## Prerequisites & Constraints

Before implementing `heading` or `sideOfRoad`, note the following constraints
and requirements:

*   **Prerequisite:** You must be constructing a routing request (e.g.,
    `computeRoutes` or `computeRouteMatrix`).
*   **Mutual Exclusivity:** `heading` and `sideOfRoad` are incompatible. **You
    cannot use both on the same waypoint.**
*   **Supported Travel Modes:** Both modifiers can only be used when the
    `travelMode` is set to `DRIVE` or `TWO_WHEELER`.
*   **Location Format (`heading`):** You can only set `heading` when specifying
    the waypoint location using a `latLng` (latitude and longitude) coordinate
    pair.
*   **Billing Impact:** Requests that include `heading` or `sideOfRoad` are
    billed at a higher rate.

--------------------------------------------------------------------------------

## 1. Specify the Vehicle Heading

The `heading` modifier specifies the compass direction you want the vehicle to
travel when it arrives at or departs from a waypoint.

*   **Placement:** Placed inside the `location` object of a `Waypoint`
    (alongside `latLng`).
*   **Values:** Whole numbers ranging from `0` to `359` (where `0` indicates due
    North, `90` is East, `180` is South, and `270` is West).

### JSON Payload Structure (`heading`)

```json
{
  "origin": {
    "location": {
      "latLng": {
        "latitude": 37.419734,
        "longitude": -122.0827784
      },
      "heading": 127
    }
  }
}
```

--------------------------------------------------------------------------------

## 2. Specify a Side of the Road Preference

A location defined by a latitude and longitude pair naturally corresponds to a
specific side of a road. However, for route optimization, the Routes API might
still route a stopover to the opposite side of the road. Setting `sideOfRoad` to
`true` instructs the route to pass through the location so the vehicle stops on
the specific side of the road the coordinates are biased toward.

*   **Placement:** Placed directly on the `Waypoint` object (as a sibling to
    `location`).
*   **Values:** Boolean (`true` or `false`).

### JSON Payload Structure (`sideOfRoad`)

```json
{
  "origin": {
    "location": {
      "latLng": {
        "latitude": 37.419734,
        "longitude": -122.0827784
      }
    },
    "sideOfRoad": true
  }
}
```

--------------------------------------------------------------------------------

## Complete REST Request Example

The following cURL example demonstrates a `computeRoutes` request where the
`origin` uses `heading` and the `destination` uses `sideOfRoad`. Notice how they
are applied to different waypoints and placed at different levels of the
waypoint hierarchy.

```bash
curl -X POST -d '{
  "origin": {
    "location": {
      "latLng": {
        "latitude": 37.419734,
        "longitude": -122.0827784
      },
      "heading": 127
    }
  },
  "destination": {
    "location": {
      "latLng": {
        "latitude": 37.417670,
        "longitude": -122.079595
      }
    },
    "sideOfRoad": true
  },
  "travelMode": "DRIVE",
  "routingPreference": "TRAFFIC_AWARE"
}' \
-H 'Content-Type: application/json' \
-H 'X-Goog-Api-Key: YOUR_API_KEY' \
-H 'X-Goog-FieldMask: routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline' \
-H 'X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1' \
'https://routes.googleapis.com/directions/v2:computeRoutes'
```

## Summary of Differences

Property     | Parent Object       | Value Type                 | Requirement
:----------- | :------------------ | :------------------------- | :----------
`heading`    | `Waypoint.location` | Integer (`0` - `359`)      | Requires `latLng` coordinates and `DRIVE` or `TWO_WHEELER` mode.
`sideOfRoad` | `Waypoint`          | Boolean (`true` / `false`) | Requires `DRIVE` or `TWO_WHEELER` mode.
