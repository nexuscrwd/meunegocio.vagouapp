# Set Waypoints Along a Route

To calculate a route using the Routes API, you must specify at least the
`origin` and `destination` locations as `Waypoint` objects. You can also specify
intermediate waypoints (`intermediates`). All waypoints in a request can use the
same location format, or you can mix and match formats across different
waypoints.

## Prerequisites

-   **Routing Request Capability**: You must have a foundational routing request
    setup (such as `computeRoutes` or `computeRouteMatrix`), including a valid
    Google Maps Platform API key and the required `X-Goog-FieldMask` header.

--------------------------------------------------------------------------------

## Waypoint Location Formats

You can define a `Waypoint` object using any of the following location formats.

### 1. Place ID (Preferred)

Using Place IDs is the most accurate and efficient method. Place IDs are
uniquely explicit and include geocoding benefits for routing, such as proper
access points (e.g., building entrances rather than road snapping) and traffic
variables.

You can retrieve Place IDs from the Places API (New) or the Geocoding API.

```json
{
  "origin": {
    "placeId": "ChIJayOTViHY5okRRoq2kGnGg8o"
  },
  "destination": {
    "placeId": "ChIJTYKK2G3X5okRgP7BZvPQ2FU"
  }
}
```

### 2. Latitude and Longitude Coordinates

Specify coordinates using the `location.latLng` object.

> **Note:** Coordinates are snapped to the nearest road, which might not be a
> valid access point to the property or a road that safely leads to the
> destination. Use coordinates only when you are confident they represent the
> exact routing points needed.

```json
{
  "origin": {
    "location": {
      "latLng": {
        "latitude": 37.419734,
        "longitude": -122.0827784
      }
    }
  },
  "destination": {
    "location": {
      "latLng": {
        "latitude": 37.417670,
        "longitude": -122.079595
      }
    }
  }
}
```

### 3. Address Strings

Pass a literal address string using the `address` property. The Routes API
internally geocodes the string into coordinates before calculating the route,
which can affect performance.

```json
{
  "origin": {
    "address": "1600 Amphitheatre Parkway, Mountain View, CA"
  },
  "destination": {
    "address": "450 Serra Mall, Stanford, CA 94305, USA"
  }
}
```

#### Biasing Address Results by Region (`regionCode`)

If you pass an incomplete or ambiguous address string (e.g., `"Toledo"`), the
API might geocode it to the wrong country (e.g., Toledo, Ohio instead of Toledo,
Spain), resulting in an empty route response `{}` if no driving route exists to
the destination.

Use the top-level `regionCode` parameter (a two-character ccTLD value, such as
`"es"` for Spain or `"uk"` for the United Kingdom) to bias geocoding results to
a specific region:

```json
{
  "origin": {
    "address": "Toledo"
  },
  "destination": {
    "address": "Madrid"
  },
  "travelMode": "DRIVE",
  "regionCode": "es"
}
```

### 4. Plus Codes

Plus Codes act as street addresses for locations that do not have standard
numbered streets or buildings, or for specific delivery points like loading
docks. Pass Plus Codes inside the `address` field.

-   **Global Code**: A 4-character area code + 6-character (or longer) local
    code (e.g., `"849VCWC8+R9"`).
-   **Compound Code**: A 6-character (or longer) local code combined with an
    explicit city/state/country string (e.g.,
    `"CRHJ+C3 Stanford, CA 94305, USA"`).

```json
{
  "origin": {
    "address": "849VCWC8+R9"
  },
  "destination": {
    "address": "CRHJ+C3 Stanford, CA 94305, USA"
  },
  "travelMode": "DRIVE"
}
```

### 5. Navigation Point Tokens (Preview)

A navigation point token encodes a location along with additional route context
to provide precise routing to specific access points like entrances, loading
docks, or rideshare pick-up zones.

1.  Obtain a token by calling the `SearchDestinations` method of the Geocoding
    API.
2.  Pass the token using the `navigation_point_token` field:

```json
{
  "origin": {
    "navigation_point_token": "ENCODED_NAVIGATION_POINT_TOKEN_FOR_ORIGIN"
  },
  "destination": {
    "navigation_point_token": "ENCODED_NAVIGATION_POINT_TOKEN_FOR_DESTINATION"
  }
}
```

--------------------------------------------------------------------------------

## Complete Example: Mixed Waypoints Request

You can mix different waypoint specification methods in a single request. The
following `curl` example uses a Place ID for the `origin`, latitude/longitude
coordinates for an `intermediates` waypoint, and an address string for the
`destination`.

```bash
curl -X POST -d '{
  "origin": {
    "placeId": "ChIJayOTViHY5okRRoq2kGnGg8o"
  },
  "intermediates": [
    {
      "location": {
        "latLng": {
          "latitude": 37.419734,
          "longitude": -122.0827784
        }
      }
    }
  ],
  "destination": {
    "address": "450 Serra Mall, Stanford, CA 94305, USA"
  },
  "travelMode": "DRIVE"
}' \
-H 'Content-Type: application/json' \
-H 'X-Goog-Api-Key: YOUR_API_KEY' \
-H 'X-Goog-FieldMask: routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline' \
-H 'X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1' \
'https://routes.googleapis.com/directions/v2:computeRoutes'
```
