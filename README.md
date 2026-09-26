# mcp-geonames

GeoNames MCP — GeoNames geographical database API

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1683+ live data sources.

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

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/geonames/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1683+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## No MCP client? Call it over HTTP

```bash
curl -X POST https://gateway.pipeworx.io/v1/tools/search_geonames \
  -H 'Content-Type: application/json' \
  -d '{"query":"Tokyo"}'
```

No account needed for the first calls. Inspect any tool: `GET https://gateway.pipeworx.io/v1/tools/search_geonames`. Find one: `POST https://gateway.pipeworx.io/v1/tools/search_packs` with `{"query":"..."}`.

## Standalone (no gateway account)

This package also runs as a local stdio MCP server — no Pipeworx account, no
gateway round-trip:

```json
{
  "mcpServers": {
    "geonames": {
      "command": "npx",
      "args": ["-y", "@pipeworx/mcp-geonames"]
    }
  }
}
```

Or run it directly to confirm it starts:

```bash
npx -y @pipeworx/mcp-geonames
```

It speaks MCP over stdin/stdout and answers `initialize`/`tools/list`/`tools/call`
for **only** this pack's tools — none of the shared meta-tools the gateway
connection above adds. Same source, same tools, no ask_pipeworx routing.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Geonames data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
