# Waku bridge for Locality Map data Service

A Waku Network light node that provides decentralized messaging capabilities for searching countries and localities. This service acts as a bridge between the Waku decentralized network and a centralized HTTP API, enabling privacy-preserving queries for geographic data.

This project is part of the Ash ecosystem, serving as a critical component that enables peer-to-peer communication between the Ash frontend application and the localitysrv backend service.

## Project Relationships

### Connection to localitysrv

This service acts as a bridge to [localitysrv](/home/lowkey/Development/logos/torality/README.md), a Rust HTTP server that serves vector tiles (pmtiles) for localities worldwide. Localitysrv runs simultaneously as both a regular HTTP server on localhost and a Tor hidden service for enhanced privacy.

The Waku Locality Service:

- Forwards search queries received via the Waku network to the localitysrv HTTP API
- Translates responses from localitysrv back into Waku network messages
- Enables Ash clients to access localitysrv functionality through the decentralized Waku network

### Connection to Ash

This service is a key component in the [Ash](/home/lowkey/Development/logos/ash/README.md) peer-to-peer field coordination system. Ash is a mapping and communication app designed for activists and protesters who need privacy and decentralized software capabilities.

In the Ash ecosystem:

- Ash clients send search queries through the Waku network
- This Waku Locality Service receives those queries
- The service forwards queries to localitysrv
- Responses are returned through the Waku network to Ash clients
- This enables Ash users to search for geographic data and download maps without relying on centralized infrastructure

This architecture provides a critical workaround until Waku communication is directly implemented in localitysrv, allowing the Ash ecosystem to function with its decentralized, privacy-preserving design principles.

## Overview

This application creates a Waku light node that listens for search queries on the Waku network, forwards them to an HTTP API, and returns the responses through the decentralized network. It supports two types of queries:

- Country search: Find countries with their locality counts
- Locality search: Find localities within a specific country

The service uses Protocol Buffers for message serialization and implements proper error handling and graceful shutdown.

## Architecture

### Core Components

1. **Waku Light Node** (`src/main.ts`)

   - Built with the @waku/sdk library
   - Connects to bootstrap peers for network discovery
   - Handles both LightPush and Filter protocols
   - Subscribes to messages on a specific content topic

2. **Protocol Buffers** (`src/main.ts`)

   - Defines message types for queries and responses
   - Supports Country and Locality data structures
   - Implements proper encoding/decoding of messages

3. **Message Handlers** (`src/main.ts`)
   - Processes incoming search queries
   - Forwards queries to the HTTP API
   - Formats and returns responses through the Waku network

### Data Flow

1. **Node Initialization**

   - Create and start a Waku light node
   - Connect to bootstrap peers
   - Wait for peer connections

2. **Message Subscription**

   - Create encoder/decoder for the content topic
   - Subscribe to incoming messages
   - Route messages based on query type

3. **Query Processing**
   - Decode incoming protobuf messages
   - Validate required fields
   - Forward queries to HTTP API
   - Encode and send responses

## Dependencies

- **@waku/sdk**: Waku network implementation
- **axios**: HTTP client for API requests
- **protobufjs**: Protocol Buffers implementation
- **tsx**: TypeScript execution

## Configuration

Constants are defined in `src/constants.ts`:

- `PORT`: HTTP API port (8080)
- `WAKU_CONTENT_TOPIC`: Content topic for messages (/ash/1/localitysrv/proto)

## Protocol Buffers Schema

### Message Types

#### CountrySearchQuery

```
message CountrySearchQuery {
  string query_id = 1;
  string query_method = 2;
  string query = 3;
  uint32 page = 4;
  uint32 limit = 5;
}
```

#### CountrySearchResponse

```
message CountrySearchResponse {
  string query_id = 1;
  repeated Country countries = 2;
  uint32 total = 3;
  uint32 page = 4;
  uint32 total_pages = 5;
}
```

#### LocalitySearchQuery

```
message LocalitySearchQuery {
  string query_id = 1;
  string query_method = 2;
  string country_code = 3;
  string query = 4;
  uint32 page = 5;
  uint32 limit = 6;
}
```

#### LocalitySearchResponse

```
message LocalitySearchResponse {
  string query_id = 1;
  repeated Locality localities = 2;
  uint32 total = 3;
  uint32 page = 4;
  uint32 total_pages = 5;
}
```

#### Country

```
message Country {
  string country_code = 1;
  string country_name = 2;
  uint32 locality_count = 3;
}
```

#### Locality

```
message Locality {
  string id = 1;
  string name = 2;
  string country = 3;
  string placetype = 4;
  float latitude = 5;
  float longitude = 6;
  float min_longitude = 7;
  float min_latitude = 8;
  float max_longitude = 9;
  float max_latitude = 10;
  uint64 file_size = 11;
  string onion_link = 12;
}
```

## API Endpoints

The service forwards queries to the following HTTP endpoints:

### Countries

- **GET** `/countries`
  - Forwards country search queries with optional parameters
  - Query parameters: q (search query), page, limit

### Localities

- **GET** `/countries/{country_code}/localities`
  - Forwards locality search queries for a specific country
  - Query parameters: q (search query), page, limit

## Installation and Usage

### Prerequisites

- Node.js 24 or higher
- pnpm 10 or higher

### Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Start the service:
   ```bash
   pnpm start
   ```

### Operation

- The service will automatically connect to Waku bootstrap peers
- It will listen for messages on the configured content topic
- Queries are processed and responses are returned through the Waku network
- Press Ctrl+C to gracefully shut down the service

## Development

### Building

```bash
pnpm build
```

### Type Checking

```bash
npx tsc --noEmit
```

### Linting

```bash
deno lint
```

## License

Licensed under GNU GPL v3+
