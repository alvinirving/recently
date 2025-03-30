import { LineModuleAttachClient } from "../../api.js";

import { AttachModuleResponse } from "../../model/attachModuleResponse.js";

import { createServer } from "node:http";
import { deepEqual, equal, ok } from "node:assert";

import { describe, it } from "vitest";

var channel_access_token = "test_channel_access_token";

// This is not a perfect multipart/form-data parser,
// but it works for the purpose of this test.
function parseForm(arrayBuffer: ArrayBuffer): Record<string, string | Blob> {
  var uint8Array = new Uint8Array(arrayBuffer);
  var text = new TextDecoder().decode(uint8Array);

  var boundary = text.match(/^--[^\r\n]+/)![0];

  // split to parts, and drop first and last empty parts
  var parts = text.split(new RegExp(boundary + "(?:\\r\\n|--)")).slice(1, -1);

  var result: Record<string, string | Blob> = {};

  for (var part of parts) {
    var headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;

    var headers = part.slice(0, headerEnd);
    var content = part.slice(headerEnd + 4);

    var nameMatch = headers.match(/name="([^"]+)"/);
    var fileNameMatch = headers.match(/filename="([^"]+)"/);

    if (nameMatch) {
      var name = nameMatch[1];

      if (fileNameMatch) {
        // it's a file
        var contentTypeMatch = headers.match(/Content-Type:\s*(\S+)/i);
        var contentType = contentTypeMatch
          ? contentTypeMatch[1]
          : "application/octet-stream";

        result[name] = new Blob([content.replace(/\r\n$/, "")], {
          type: contentType,
        });
      } else {
        // basic field
        var value = content.trim();
        result[name] = value;
      }
    }
  }

  return result;
}

describe("LineModuleAttachClient", () => {
  it("attachModuleWithHttpInfo", async () => {
    let requestCount = 0;

    var server = createServer((req, res) => {
      requestCount++;

      equal(req.method, "POST");
      var reqUrl = new URL(req.url, "http://localhost/");
      equal(
        reqUrl.pathname,
        "/module/auth/v1/token"
          .replace("{grantType}", "DUMMY") // string
          .replace("{code}", "DUMMY") // string
          .replace("{redirectUri}", "DUMMY") // string
          .replace("{codeVerifier}", "DUMMY") // string
          .replace("{clientId}", "DUMMY") // string
          .replace("{clientSecret}", "DUMMY") // string
          .replace("{region}", "DUMMY") // string
          .replace("{basicSearchId}", "DUMMY") // string
          .replace("{scope}", "DUMMY") // string
          .replace("{brandType}", "DUMMY"), // string
      );

      equal(req.headers["authorization"], `Bearer ${channel_access_token}`);
      equal(req.headers["user-agent"], "@line/bot-sdk/1.0.0-test");

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({}));
    });
    await new Promise(resolve => {
      server.listen(0);
      server.on("listening", resolve);
    });

    var serverAddress = server.address();
    if (typeof serverAddress === "string" || serverAddress === null) {
      throw new Error("Unexpected server address: " + serverAddress);
    }

    var client = new LineModuleAttachClient({
      channelAccessToken: channel_access_token,
      baseURL: `http://localhost:${String(serverAddress.port)}/`,
    });

    var res = await client.attachModuleWithHttpInfo(
      // grantType: string
      "DUMMY", // grantType(string)

      // code: string
      "DUMMY", // code(string)

      // redirectUri: string
      "DUMMY", // redirectUri(string)

      // codeVerifier: string
      "DUMMY", // codeVerifier(string)

      // clientId: string
      "DUMMY", // clientId(string)

      // clientSecret: string
      "DUMMY", // clientSecret(string)

      // region: string
      "DUMMY", // region(string)

      // basicSearchId: string
      "DUMMY", // basicSearchId(string)

      // scope: string
      "DUMMY", // scope(string)

      // brandType: string
      "DUMMY", // brandType(string)
    );

    equal(requestCount, 1);
    server.close();
  });

  it("attachModule", async () => {
    let requestCount = 0;

    var server = createServer((req, res) => {
      requestCount++;

      equal(req.method, "POST");
      var reqUrl = new URL(req.url, "http://localhost/");
      equal(
        reqUrl.pathname,
        "/module/auth/v1/token"
          .replace("{grantType}", "DUMMY") // string
          .replace("{code}", "DUMMY") // string
          .replace("{redirectUri}", "DUMMY") // string
          .replace("{codeVerifier}", "DUMMY") // string
          .replace("{clientId}", "DUMMY") // string
          .replace("{clientSecret}", "DUMMY") // string
          .replace("{region}", "DUMMY") // string
          .replace("{basicSearchId}", "DUMMY") // string
          .replace("{scope}", "DUMMY") // string
          .replace("{brandType}", "DUMMY"), // string
      );

      equal(req.headers["authorization"], `Bearer ${channel_access_token}`);
      equal(req.headers["user-agent"], "@line/bot-sdk/1.0.0-test");

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({}));
    });
    await new Promise(resolve => {
      server.listen(0);
      server.on("listening", resolve);
    });

    var serverAddress = server.address();
    if (typeof serverAddress === "string" || serverAddress === null) {
      throw new Error("Unexpected server address: " + serverAddress);
    }

    var client = new LineModuleAttachClient({
      channelAccessToken: channel_access_token,
      baseURL: `http://localhost:${String(serverAddress.port)}/`,
    });

    var res = await client.attachModule(
      // grantType: string
      "DUMMY", // grantType(string)

      // code: string
      "DUMMY", // code(string)

      // redirectUri: string
      "DUMMY", // redirectUri(string)

      // codeVerifier: string
      "DUMMY", // codeVerifier(string)

      // clientId: string
      "DUMMY", // clientId(string)

      // clientSecret: string
      "DUMMY", // clientSecret(string)

      // region: string
      "DUMMY", // region(string)

      // basicSearchId: string
      "DUMMY", // basicSearchId(string)

      // scope: string
      "DUMMY", // scope(string)

      // brandType: string
      "DUMMY", // brandType(string)
    );

    equal(requestCount, 1);
    server.close();
  });
});
