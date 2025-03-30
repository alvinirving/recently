import { ok } from "node:assert";
import validateSignature from "../lib/validate-signature.js";

import { describe, it } from "vitest";

let body = { hello: "world" };
let secret = "test_secret";

describe("validateSignature", () => {
  it("success", () => {
    let validSignature = "t7Hn4ZDHqs6e+wdvI5TyQIvzie0DmMUmuXEBqyyE/tM=";
    ok(validateSignature(JSON.stringify(body), secret, validSignature));
  });

  it("failure", () => {
    let invalidSignature = "t7Hn4ZDHqs6e+wdvi5TyQivzie0DmMUmuXEBqyyE/tM=";
    ok(!validateSignature(JSON.stringify(body), secret, invalidSignature));
  });
});
