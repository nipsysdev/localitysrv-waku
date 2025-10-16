import process from "node:process";
import { createLightNode, Protocols } from "@waku/sdk";
import protobuf from "protobufjs";
import axios from "axios";
import { WAKU_CONTENT_TOPIC, WAKU_BOOTSTRAP_PEERS } from "./constants";

process.on("SIGINT", exit);
process.on("SIGTERM", exit);

const BASE_URL = "http://127.0.0.1:8080";

console.log("Creating Waku light node...");
const wakuNode = await createLightNode({
  defaultBootstrap: false,
  bootstrapPeers: WAKU_BOOTSTRAP_PEERS,
});

await wakuNode.start();
console.log("Waku node started");

await wakuNode.waitForPeers([Protocols.LightPush, Protocols.Filter]);
console.log("Connected to Waku peers");

const encoder = wakuNode.createEncoder({ contentTopic: WAKU_CONTENT_TOPIC });
const decoder = wakuNode.createDecoder({ contentTopic: WAKU_CONTENT_TOPIC });

// Define protobuf message types
const Country = new protobuf.Type('Country')
  .add(new protobuf.Field('country_code', 1, 'string'))
  .add(new protobuf.Field('country_name', 2, 'string'))
  .add(new protobuf.Field('locality_count', 3, 'uint32'));

const Locality = new protobuf.Type('Locality')
  .add(new protobuf.Field('id', 1, 'string'))
  .add(new protobuf.Field('name', 2, 'string'))
  .add(new protobuf.Field('country', 3, 'string'))
  .add(new protobuf.Field('file_size', 4, 'uint64'));

const CountrySearchQuery = new protobuf.Type('CountrySearchQuery')
  .add(new protobuf.Field('query_id', 1, 'string'))
  .add(new protobuf.Field('query_method', 2, 'string'))
  .add(new protobuf.Field('query', 3, 'string'))
  .add(new protobuf.Field('page', 4, 'uint32'))
  .add(new protobuf.Field('limit', 5, 'uint32'));

const CountrySearchResponse = new protobuf.Type('CountrySearchResponse')
  .add(new protobuf.Field('query_id', 1, 'string'))
  .add(new protobuf.Field('countries', 2, 'Country', 'repeated'))
  .add(new protobuf.Field('total', 3, 'uint32'))
  .add(new protobuf.Field('page', 4, 'uint32'))
  .add(new protobuf.Field('total_pages', 5, 'uint32'));

const LocalitySearchQuery = new protobuf.Type('LocalitySearchQuery')
  .add(new protobuf.Field('query_id', 1, 'string'))
  .add(new protobuf.Field('query_method', 2, 'string'))
  .add(new protobuf.Field('country_code', 3, 'string'))
  .add(new protobuf.Field('query', 4, 'string'))
  .add(new protobuf.Field('page', 5, 'uint32'))
  .add(new protobuf.Field('limit', 6, 'uint32'));

const LocalitySearchResponse = new protobuf.Type('LocalitySearchResponse')
  .add(new protobuf.Field('query_id', 1, 'string'))
  .add(new protobuf.Field('localities', 2, 'Locality', 'repeated'))
  .add(new protobuf.Field('total', 3, 'uint32'))
  .add(new protobuf.Field('page', 4, 'uint32'))
  .add(new protobuf.Field('total_pages', 5, 'uint32'));

// Create a root namespace and add the message types
const root = new protobuf.Root();
root.add(CountrySearchQuery);
root.add(Country);
root.add(CountrySearchResponse);
root.add(LocalitySearchQuery);
root.add(Locality);
root.add(LocalitySearchResponse);

console.log("Setting up message subscriptions...");
await wakuNode.filter.subscribe([decoder], async (wakuMessage: any) => {
  if (!wakuMessage.payload) return;
  
  try {
    console.log("Received message payload");
    
    // Try to decode as CountrySearchQuery first
    try {
      const countryQuery = CountrySearchQuery.decode(wakuMessage.payload) as any;
      
      // Check if both query_id and query_method exist
      if (!countryQuery.query_id || !countryQuery.query_method) {
        console.log("CountrySearchQuery message missing required fields (query_id or query_method)");
        return;
      }
      
      console.log("Decoded CountrySearchQuery with method:", countryQuery.query_method);
      
      // Route based on query_method
      if (countryQuery.query_method === "search_country") {
        console.log("Routing to country search handler");
        await handleCountrySearch(countryQuery);
        return;
      } else if (countryQuery.query_method === "search_locality") {
        console.log("CountrySearchQuery has search_locality method, trying LocalitySearchQuery decode");
        // Fall through to try LocalitySearchQuery
      } else {
        console.log("Unknown query method in CountrySearchQuery:", countryQuery.query_method);
        return;
      }
    } catch (countryError) {
      // Not a country query, continue to try locality query
      console.log("Message is not a CountrySearchQuery, trying LocalitySearchQuery");
    }
    
    // Try to decode as LocalitySearchQuery only if CountrySearchQuery failed
    try {
      const localityQuery = LocalitySearchQuery.decode(wakuMessage.payload) as any;
      
      // Check if both query_id and query_method exist
      if (!localityQuery.query_id || !localityQuery.query_method) {
        console.log("LocalitySearchQuery message missing required fields (query_id or query_method)");
        return;
      }
      
      console.log("Decoded LocalitySearchQuery with method:", localityQuery.query_method);
      
      // Route based on query_method
      if (localityQuery.query_method === "search_locality") {
        console.log("Routing to locality search handler");
        await handleLocalitySearch(localityQuery);
        return;
      } else if (localityQuery.query_method === "search_country") {
        console.log("LocalitySearchQuery has search_country method, but should have been decoded as CountrySearchQuery");
        return;
      } else {
        console.log("Unknown query method in LocalitySearchQuery:", localityQuery.query_method);
        return;
      }
    } catch (localityError) {
      // This is expected for response messages or messages that don't match either format
      console.log("Message is not a query type (likely a response or different message type)");
    }
  } catch (error) {
    console.error("Failed to process message:", error);
  }
});

async function handleCountrySearch(query: any) {
  try {
    const params = new URLSearchParams();
    if (query.query) params.append('q', query.query);
    if (query.page) params.append('page', query.page.toString());
    if (query.limit) params.append('limit', query.limit.toString());
    
    const queryString = params.toString();
    const url = `${BASE_URL}/countries${queryString ? '?' + queryString : ''}`;
    
    console.log(`Making request to: ${url}`);
    
    const response = await axios.get(url);
    console.log("Received response:", response.data);
    
    // Create response message
    const responseData = response.data;
    console.log("Mapping country data:", responseData.data);
    const countries = (responseData.data || []).map((country: any) => {
      console.log("Processing country:", country);
      return Country.create({
        country_code: country.country_code,
        country_name: country.country_name,
        locality_count: country.locality_count
      });
    });
    
    const responseMessage = CountrySearchResponse.create({
      query_id: query.query_id,
      countries,
      total: responseData.pagination?.total || 0,
      page: responseData.pagination?.page || 1,
      total_pages: responseData.pagination?.totalPages || 1
    });
    
    // Encode and send response
    const payload = CountrySearchResponse.encode(responseMessage).finish();
    await wakuNode.lightPush.send(encoder, { payload });
    
    console.log("Sent country search response");
  } catch (error) {
    console.error("Failed to handle country search:", error);
  }
}

async function handleLocalitySearch(query: any) {
  try {
    const params = new URLSearchParams();
    if (query.query) params.append('q', query.query);
    if (query.page) params.append('page', query.page.toString());
    if (query.limit) params.append('limit', query.limit.toString());
    
    const queryString = params.toString();
    const url = `${BASE_URL}/countries/${query.country_code}/localities${queryString ? '?' + queryString : ''}`;
    
    console.log(`Making request to: ${url}`);
    
    const response = await axios.get(url);
    console.log("Received response:", response.data);
    
    // Create response message
    const responseData = response.data;
    const localities = (responseData.data || []).map((locality: any) => Locality.create({
      id: locality.id.toString(),
      name: locality.name,
      country: locality.country,
      file_size: locality.fileSize || 0
    }));
    
    const responseMessage = LocalitySearchResponse.create({
      query_id: query.query_id,
      localities,
      total: responseData.pagination?.total || 0,
      page: responseData.pagination?.page || 1,
      total_pages: responseData.pagination?.totalPages || 1
    });
    
    // Encode and send response
    const payload = LocalitySearchResponse.encode(responseMessage).finish();
    await wakuNode.lightPush.send(encoder, { payload });
    
    console.log("Sent locality search response");
  } catch (error) {
    console.error("Failed to handle locality search:", error);
  }
}

console.log(`Waku node is running and listening for messages on topic: ${WAKU_CONTENT_TOPIC}`);
console.log("Press Ctrl+C to stop");

function exit() {
  console.log("\nShutting down...");
  wakuNode.stop();
  process.exit(0);
}
