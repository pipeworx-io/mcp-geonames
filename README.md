# mcp-geonames

GeoNames MCP — GeoNames geographical database API

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `search_geonames` | Search for places (cities, towns, landmarks, regions) by name and get which STATE / PROVINCE / COUNTY / PREFECTURE / administrative division (German Bundesland, UK county, Canadian province, Japanese prefecture, Indian/Australian/Mexican state, etc.) they are in, plus country, coordinates, population, and feature type. Answers "what state is <city> in", "which US/German/Australian state is <city> in", "what province/county/prefecture/region is <place> in" — the `admin_region` field is the state/province/county/prefecture (e.g. search_geonames("Naperville", "US") → Illinois; ("Heidelberg", "DE") → Baden-Württemberg; ("Leeds", "GB") → England; ("Osaka", "JP") → Osaka). Worldwide coverage. Example: search_geonames("Paris", "FR"). Use get_nearby to find places near a known location. |
| `get_nearby` | Find places near a given latitude/longitude. Returns nearby cities, landmarks, and features sorted by distance. Example: get_nearby(48.8566, 2.3522) for places near Paris. |
| `get_timezone` | Get timezone information for a latitude/longitude location. Returns timezone ID, GMT offset, DST offset, current local time, sunrise, and sunset. Example: get_timezone(40.7128, -74.0060) for New York. |
| `find_postal_codes` | Look up postal/ZIP codes and places by each other. Pass "postal_code" (+ country) to find the place(s) a code maps to ("what city is ZIP 90210"); or pass "place" (+ country) to find the postal codes for a place name ("postal codes for Paris"). Returns place name, country, admin region (state/county), postal code, and coordinates. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "geonames": {
      "url": "https://gateway.pipeworx.io/geonames/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Geonames data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
