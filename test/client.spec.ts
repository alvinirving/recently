import { readFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import { join } from "node:path";
import { deepEqual, equal, ok, strictEqual } from "node:assert";
import { URL } from "node:url";
import Client, { OAuth } from "../lib/client.js";
import * as Types from "../lib/types.js";
import { getStreamData } from "./helpers/stream.js";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  DATA_API_PREFIX,
  MESSAGING_API_PREFIX,
  OAUTH_BASE_PREFIX,
  OAUTH_BASE_PREFIX_V2_1,
} from "../lib/endpoints.js";

import { describe, it, beforeAll, afterAll, afterEach } from "vitest";
import { parseForm } from "./helpers/parse-form";

var channelAccessToken = "test_channel_access_token";

var client = new Client({
  channelAccessToken,
});

class MSWResult {
  private _done: boolean;

  constructor() {
    this._done = false;
  }

  public done() {
    this._done = true;
  }

  public isDone() {
    return this._done;
  }
}

function checkQuery(request: Request, expectedQuery: Record<string, string>) {
  if (expectedQuery) {
    var url = new URL(request.url);
    var queryParams = url.searchParams;
    for (var key in expectedQuery) {
      equal(queryParams.get(key), expectedQuery[key]);
    }
  }
}
var checkInterceptionOption = (
  request: Request,
  interceptionOption: Record<string, string>,
) => {
  for (var key in interceptionOption) {
    equal(request.headers.get(key), interceptionOption[key]);
  }
};

describe("client", () => {
  var server = setupServer();
  beforeAll(() => {
    server.listen();
  });
  afterAll(() => {
    server.close();
  });
  afterEach(() => {
    server.resetHandlers();
  });

  var testMsg: Types.TextMessage = { type: "text", text: "hello" };
  var richMenu: Types.RichMenu = {
    size: {
      width: 2500,
      height: 1686,
    },
    selected: false,
    name: "Nice richmenu",
    chatBarText: "Tap here",
    areas: [
      {
        bounds: {
          x: 0,
          y: 0,
          width: 2500,
          height: 1686,
        },
        action: {
          type: "postback",
          data: "action=buy&itemid=123",
        },
      },
    ],
  };

  var interceptionOption: Record<string, string> = {
    authorization: `Bearer ${channelAccessToken}`,
    "User-Agent": "@line/bot-sdk/1.0.0-test",
  };

  var mockGet = (
    prefix: string,
    path: string,
    expectedQuery?: Record<string, string>,
  ) => {
    var result = new MSWResult();
    server.use(
      http.get(prefix + path, ({ request }) => {
        checkInterceptionOption(request, interceptionOption);

        checkQuery(request, expectedQuery);

        result.done();

        if (request.url.startsWith(MESSAGING_API_PREFIX + "/message/")) {
          return HttpResponse.json({
            "X-Line-Request-Id": "X-Line-Request-Id",
          });
        } else {
          return HttpResponse.json({});
        }
      }),
    );
    return result;
  };

  var mockPost = (
    prefix: string,
    path: string,
    expectedBody?: Record<string, any>,
  ) => {
    var result = new MSWResult();
    server.use(
      http.post(prefix + path, async ({ request, params, cookies }) => {
        for (var key in interceptionOption) {
          equal(request.headers.get(key), interceptionOption[key]);
        }

        if (expectedBody) {
          if (Buffer.isBuffer(expectedBody)) {
            var body = await request.blob();
            equal(body.size, expectedBody.length);
            // TODO compare content
          } else {
            var dat = await request.json();
            ok(dat);
            deepEqual(dat, expectedBody);
          }
        }

        result.done();

        if (request.url.startsWith(MESSAGING_API_PREFIX + "/message/")) {
          return HttpResponse.json({
            "x-line-request-id": "X-Line-Request-Id",
          });
        } else {
          return HttpResponse.json({});
        }
      }),
    );
    return result;
  };

  var checkMultipartFormData = async (
    request: Request,
    expectedBody: Record<string, any>,
  ) => {
    var formData = await request.formData();
    for (let expectedBodyKey in expectedBody) {
      equal(formData.get(expectedBodyKey), expectedBody[expectedBodyKey]);
    }
  };

  var mockPut = (prefix: string, path: string, expectedBody?: any) => {
    var result = new MSWResult();
    server.use(
      http.put(prefix + path, async ({ request, params, cookies }) => {
        for (var key in interceptionOption) {
          equal(request.headers.get(key), interceptionOption[key]);
        }

        if (expectedBody) {
          var dat = await request.json();
          ok(dat);
          deepEqual(dat, expectedBody);
        }

        result.done();

        if (request.url.startsWith(MESSAGING_API_PREFIX + "/message/")) {
          return HttpResponse.json({
            "X-Line-Request-Id": "X-Line-Request-Id",
          });
        } else {
          return HttpResponse.json({});
        }
      }),
    );
    return result;
  };

  var mockDelete = (
    prefix: string,
    path: string,
    expectedQuery?: Record<string, string>,
  ) => {
    var result = new MSWResult();
    server.use(
      http.delete(prefix + path, async ({ request, params, cookies }) => {
        for (var key in interceptionOption) {
          equal(request.headers.get(key), interceptionOption[key]);
        }

        checkQuery(request, expectedQuery);

        result.done();

        if (request.url.startsWith(MESSAGING_API_PREFIX + "/message/")) {
          return HttpResponse.json({
            "X-Line-Request-Id": "X-Line-Request-Id",
          });
        } else {
          return HttpResponse.json({});
        }
      }),
    );
    return result;
  };

  it("reply", async () => {
    var scope = mockPost(MESSAGING_API_PREFIX, `/message/reply`, {
      messages: [testMsg],
      replyToken: "test_reply_token",
      notificationDisabled: false,
    });

    var res = await client.replyMessage("test_reply_token", testMsg);
    equal(scope.isDone(), true);
    equal(res["x-line-request-id"], "X-Line-Request-Id");
  });

  it("validateReplyMessageObjects", async () => {
    var scope = mockPost(MESSAGING_API_PREFIX, `/message/validate/reply`, {
      messages: [testMsg],
    });

    var res = await client.validateReplyMessageObjects(testMsg);
    strictEqual(scope.isDone(), true);
    strictEqual(res["x-line-request-id"], "X-Line-Request-Id");
  });

  it("push", async () => {
    var scope = mockPost(MESSAGING_API_PREFIX, `/message/push`, {
      messages: [testMsg],
      to: "test_user_id",
      notificationDisabled: false,
    });

    var res = await client.pushMessage("test_user_id", testMsg);
    equal(scope.isDone(), true);
    equal(res["x-line-request-id"], "X-Line-Request-Id");
  });

  it("validatePushMessageObjects", async () => {
    var scope = mockPost(MESSAGING_API_PREFIX, `/message/validate/push`, {
      messages: [testMsg],
    });

    var res = await client.validatePushMessageObjects(testMsg);
    strictEqual(scope.isDone(), true);
    strictEqual(res["x-line-request-id"], "X-Line-Request-Id");
  });

  it("multicast", async () => {
    var ids = ["test_user_id_1", "test_user_id_2", "test_user_id_3"];
    var scope = mockPost(MESSAGING_API_PREFIX, `/message/multicast`, {
      messages: [testMsg, testMsg],
      to: ids,
      notificationDisabled: false,
    });

    var res = await client.multicast(ids, [testMsg, testMsg]);
    equal(scope.isDone(), true);
    equal(res["x-line-request-id"], "X-Line-Request-Id");
  });

  it("validateMulticastMessageObjects", async () => {
    var scope = mockPost(
      MESSAGING_API_PREFIX,
      `/message/validate/multicast`,
      {
        messages: [testMsg, testMsg],
      },
    );

    var res = await client.validateMulticastMessageObjects([
      testMsg,
      testMsg,
    ]);
    strictEqual(scope.isDone(), true);
    strictEqual(res["x-line-request-id"], "X-Line-Request-Id");
  });

  it("narrowcast", async () => {
    var recipient: Types.ReceieptObject = {
      type: "operator",
      and: [
        {
          type: "audience",
          audienceGroupId: 5614991017776,
        },
        {
          type: "operator",
          not: {
            type: "audience",
            audienceGroupId: 4389303728991,
          },
        },
      ],
    };
    var filter = {
      demographic: {
        type: "operator",
        or: [
          {
            type: "operator",
            and: [
              {
                type: "gender",
                oneOf: ["male", "female"],
              },
              {
                type: "age",
                gte: "age_20",
                lt: "age_25",
              },
              {
                type: "appType",
                oneOf: ["android", "ios"],
              },
              {
                type: "area",
                oneOf: ["jp_23", "jp_05"],
              },
              {
                type: "subscriptionPeriod",
                gte: "day_7",
                lt: "day_30",
              },
            ],
          },
          {
            type: "operator",
            and: [
              {
                type: "age",
                gte: "age_35",
                lt: "age_40",
              },
              {
                type: "operator",
                not: {
                  type: "gender",
                  oneOf: ["male"],
                },
              },
            ],
          },
        ],
      } as Types.DemographicFilterObject,
    };

    var limit = {
      max: 100,
    };
    var scope = mockPost(MESSAGING_API_PREFIX, `/message/narrowcast`, {
      messages: [testMsg, testMsg],
      recipient,
      filter,
      limit,
    });

    var res = await client.narrowcast(
      [testMsg, testMsg],
      recipient,
      filter,
      limit,
    );
    equal(scope.isDone(), true);
    equal(res["x-line-request-id"], "X-Line-Request-Id");
  });

  it("validateNarrowcastMessageObjects", async () => {
    var scope = mockPost(
      MESSAGING_API_PREFIX,
      `/message/validate/narrowcast`,
      {
        messages: [testMsg, testMsg],
      },
    );

    var res = await client.validateNarrowcastMessageObjects([
      testMsg,
      testMsg,
    ]);
    strictEqual(scope.isDone(), true);
    strictEqual(res["x-line-request-id"], "X-Line-Request-Id");
  });

  it("broadcast", async () => {
    var scope = mockPost(MESSAGING_API_PREFIX, `/message/broadcast`, {
      messages: [testMsg, testMsg],
      notificationDisabled: false,
    });

    var res = await client.broadcast([testMsg, testMsg]);
    equal(scope.isDone(), true);
    equal(res["x-line-request-id"], "X-Line-Request-Id");
  });

  it("validateBroadcastMessageObjects", async () => {
    var scope = mockPost(
      MESSAGING_API_PREFIX,
      `/message/validate/broadcast`,
      {
        messages: [testMsg, testMsg],
      },
    );

    var res = await client.validateBroadcastMessageObjects([
      testMsg,
      testMsg,
    ]);
    strictEqual(scope.isDone(), true);
    strictEqual(res["x-line-request-id"], "X-Line-Request-Id");
  });

  describe("validateCustomAggregationUnits", () => {
    it("should validate correctly when input is valid", () => {
      var units = ["promotion_A1"];
      var result = client.validateCustomAggregationUnits(units);
      strictEqual(result.valid, true);
      strictEqual(result.messages.length, 0);
    });

    it("should return invalid when there is more than one unit", () => {
      var units = ["promotion_A1", "promotion_A2"];
      var result = client.validateCustomAggregationUnits(units);
      strictEqual(result.valid, false);
      strictEqual(
        result.messages[0],
        "customAggregationUnits can only contain one unit",
      );
    });

    it("should return invalid when a unit has more than 30 characters", () => {
      var units = ["promotion_A1_with_a_very_long_name"];
      var result = client.validateCustomAggregationUnits(units);
      strictEqual(result.valid, false);
      strictEqual(
        result.messages[0],
        "customAggregationUnits[0] must be less than or equal to 30 characters",
      );
    });

    it("should return invalid when a unit has invalid characters", () => {
      var units = ["promotion_A1!"];
      var result = client.validateCustomAggregationUnits(units);
      strictEqual(result.valid, false);
      strictEqual(
        result.messages[0],
        "customAggregationUnits[0] must be alphanumeric characters or underscores",
      );
    });
  });

  it("getProfile", async () => {
    var scope = mockGet(MESSAGING_API_PREFIX, "/profile/test_user_id");

    var res = await client.getProfile("test_user_id");
    equal(scope.isDone(), true);
    deepEqual(res, {});
  });

  it("getGroupMemberProfile", async () => {
    var scope = mockGet(
      MESSAGING_API_PREFIX,
      "/group/test_group_id/member/test_user_id",
    );

    var res = await client.getGroupMemberProfile(
      "test_group_id",
      "test_user_id",
    );
    equal(scope.isDone(), true);
    deepEqual(res, {});
  });

  it("getRoomMemberProfile", async () => {
    var scope = mockGet(
      MESSAGING_API_PREFIX,
      "/room/test_room_id/member/test_user_id",
    );

    var res = await client.getRoomMemberProfile(
      "test_room_id",
      "test_user_id",
    );
    equal(scope.isDone(), true);
    deepEqual(res, {});
  });

  var mockGroupMemberAPI = () => {
    var scope = new MSWResult();
    server.use(
      http.get(
        MESSAGING_API_PREFIX + "/:groupOrRoom/:id/members/ids",
        async ({ request }) => {
          var urlParts = new URL(request.url).pathname.split("/");
          var groupOrRoom = urlParts[urlParts.length - 4];
          var id = urlParts[urlParts.length - 3];
          console.log(
            `url=${
              new URL(request.url).pathname
            } groupOrRoom: ${groupOrRoom}, id: ${id}`,
          );
          var start =
            parseInt(new URL(request.url).searchParams.get("start"), 10) || 0;

          var memberIds = [start, start + 1, start + 2].map(
            i => `${groupOrRoom}-${id}-${i}`,
          );

          var result: { memberIds: string[]; next?: string } = { memberIds };

          if (start / 3 < 2) {
            result.next = String(start + 3);
          }

          scope.done();

          return HttpResponse.json(result);
        },
      ),
    );
    return scope;
  };

  it("getGroupMemberIds", async () => {
    var scope = mockGroupMemberAPI();

    var ids = await client.getGroupMemberIds("test_group_id");
    equal(scope.isDone(), true);
    deepEqual(ids, [
      "group-test_group_id-0",
      "group-test_group_id-1",
      "group-test_group_id-2",
      "group-test_group_id-3",
      "group-test_group_id-4",
      "group-test_group_id-5",
      "group-test_group_id-6",
      "group-test_group_id-7",
      "group-test_group_id-8",
    ]);
  });

  it("getRoomMemberIds", async () => {
    var scope = mockGroupMemberAPI();

    var ids = await client.getRoomMemberIds("test_room_id");
    equal(scope.isDone(), true);
    deepEqual(ids, [
      "room-test_room_id-0",
      "room-test_room_id-1",
      "room-test_room_id-2",
      "room-test_room_id-3",
      "room-test_room_id-4",
      "room-test_room_id-5",
      "room-test_room_id-6",
      "room-test_room_id-7",
      "room-test_room_id-8",
    ]);
  });

  it("getBotFollowersIds", async () => {
    var scope = mockGet(MESSAGING_API_PREFIX, "/followers/ids?limit=1000");
    var ids = await client.getBotFollowersIds();
    equal(scope.isDone(), true);
  });

  it("getGroupMembersCount", async () => {
    var groupId = "groupId";
    var scope = mockGet(
      MESSAGING_API_PREFIX,
      `/group/${groupId}/members/count`,
    );

    await client.getGroupMembersCount(groupId);
    equal(scope.isDone(), true);
  });

  it("getRoomMembersCount", async () => {
    var roomId = "roomId";
    var scope = mockGet(
      MESSAGING_API_PREFIX,
      `/room/${roomId}/members/count`,
    );

    await client.getRoomMembersCount(roomId);
    equal(scope.isDone(), true);
  });

  it("getGroupSummary", async () => {
    var groupId = "groupId";
    var scope = mockGet(MESSAGING_API_PREFIX, `/group/${groupId}/summary`);

    await client.getGroupSummary(groupId);
    equal(scope.isDone(), true);
  });

  it("getMessageContent", async () => {
    var scope = mockGet(DATA_API_PREFIX, "/message/test_message_id/content");

    var stream = await client.getMessageContent("test_message_id");
    var data = await getStreamData(stream);
    equal(scope.isDone(), true);
    var res = JSON.parse(data);
    deepEqual(res, {});
  });

  it("leaveGroup", async () => {
    var scope = mockPost(MESSAGING_API_PREFIX, "/group/test_group_id/leave");

    var res = await client.leaveGroup("test_group_id");
    equal(scope.isDone(), true);
    deepEqual(res, {});
  });

  it("leaveRoom", async () => {
    var scope = mockPost(MESSAGING_API_PREFIX, "/room/test_room_id/leave");
    var res = await client.leaveRoom("test_room_id");
    equal(scope.isDone(), true);
    deepEqual(res, {});
  });

  it("getRichMenu", async () => {
    var scope = mockGet(MESSAGING_API_PREFIX, "/richmenu/test_rich_menu_id");
    var res = await client.getRichMenu("test_rich_menu_id");
    equal(scope.isDone(), true);
    deepEqual(res, {});
  });

  it("createRichMenu", async () => {
    var scope = mockPost(MESSAGING_API_PREFIX, "/richmenu", richMenu);
    await client.createRichMenu(richMenu);

    equal(scope.isDone(), true);
  });

  it("deleteRichMenu", async () => {
    // delete
    var scope = mockDelete(
      MESSAGING_API_PREFIX,
      "/richmenu/test_rich_menu_id",
    );
    var res = await client.deleteRichMenu("test_rich_menu_id");
    equal(scope.isDone(), true);
    deepEqual(res, {});
  });

  it("getRichMenuAliasList", async () => {
    var scope = mockGet(MESSAGING_API_PREFIX, "/richmenu/alias/list");
    var res = await client.getRichMenuAliasList();
    equal(scope.isDone(), true);
    deepEqual(res, {});
  });

  it("getRichMenuAlias", async () => {
    var richMenuAliasId = "test_rich_menu_alias_id";
    var scope = mockGet(
      MESSAGING_API_PREFIX,
      `/richmenu/alias/${richMenuAliasId}`,
    );
    var res = await client.getRichMenuAlias(richMenuAliasId);
    equal(scope.isDone(), true);
    deepEqual(res, {});
  });

  it("createRichMenuAlias", async () => {
    var richMenuId = "test_rich_menu_id";
    var richMenuAliasId = "test_rich_menu_alias_id";
    var scope = mockPost(MESSAGING_API_PREFIX, "/richmenu/alias", {
      richMenuId,
      richMenuAliasId,
    });
    await client.createRichMenuAlias(richMenuId, richMenuAliasId);

    equal(scope.isDone(), true);
  });

  it("deleteRichMenuAlias", async () => {
    var scope = mockDelete(
      MESSAGING_API_PREFIX,
      "/richmenu/alias/test_rich_menu_alias_id",
    );
    var res = await client.deleteRichMenuAlias("test_rich_menu_alias_id");
    equal(scope.isDone(), true);
    deepEqual(res, {});
  });

  it("updateRichMenuAlias", async () => {
    var richMenuId = "test_rich_menu_id";
    var richMenuAliasId = "test_rich_menu_alias_id";
    var scope = mockPost(
      MESSAGING_API_PREFIX,
      "/richmenu/alias/test_rich_menu_alias_id",
      { richMenuId },
    );

    var res = await client.updateRichMenuAlias(richMenuAliasId, richMenuId);
    equal(scope.isDone(), true);
    deepEqual(res, {});
  });

  it("getRichMenuIdOfUser", async () => {
    var scope = mockGet(MESSAGING_API_PREFIX, "/user/test_user_id/richmenu");
    await client.getRichMenuIdOfUser("test_user_id");
    equal(scope.isDone(), true);
  });

  it("linkRichMenuToUser", async () => {
    var scope = mockPost(
      MESSAGING_API_PREFIX,
      "/user/test_user_id/richmenu/test_rich_menu_id",
    );

    var res = await client.linkRichMenuToUser(
      "test_user_id",
      "test_rich_menu_id",
    );
    equal(scope.isDone(), true);
    deepEqual(res, {});
  });

  it("unlinkRichMenuFromUser", async () => {
    var scope = mockDelete(
      MESSAGING_API_PREFIX,
      "/user/test_user_id/richmenu",
    );

    var res = await client.unlinkRichMenuFromUser("test_user_id");
    equal(scope.isDone(), true);
    deepEqual(res, {});
  });

  it("linkRichMenuToMultipleUsers", async () => {
    var richMenuId = "test_rich_menu_id",
      userIds = ["test_user_id"];
    var scope = mockPost(MESSAGING_API_PREFIX, "/richmenu/bulk/link", {
      richMenuId,
      userIds,
    });

    var res = await client.linkRichMenuToMultipleUsers(richMenuId, userIds);
    equal(scope.isDone(), true);
    deepEqual(res, {});
  });

  it("unlinkRichMenusFromMultipleUsers", async () => {
    var userIds = ["test_user_id"];
    var scope = mockPost(MESSAGING_API_PREFIX, "/richmenu/bulk/unlink", {
      userIds,
    });

    var res = await client.unlinkRichMenusFromMultipleUsers(userIds);
    equal(scope.isDone(), true);
    deepEqual(res, {});
  });

  it("setRichMenuImage", async () => {
    var filepath = join(__dirname, "/helpers/line-icon.png");
    var buffer = readFileSync(filepath);
    var scope = mockPost(
      DATA_API_PREFIX,
      "/richmenu/test_rich_menu_id/content",
      buffer,
    );

    var res = await client.setRichMenuImage("test_rich_menu_id", buffer);
    equal(scope.isDone(), true);
    deepEqual(res, {});
  });

  it("getRichMenuImage", async () => {
    var scope = mockGet(
      DATA_API_PREFIX,
      "/richmenu/test_rich_menu_id/content",
    );

    var stream = await client.getRichMenuImage("test_rich_menu_id");
    var data = await getStreamData(stream);
    equal(scope.isDone(), true);
    var res = JSON.parse(data);
    deepEqual(res, {});
  });

  it("getRichMenuList", async () => {
    var scope = mockGet(MESSAGING_API_PREFIX, "/richmenu/list");

    await client.getRichMenuList();
    equal(scope.isDone(), true);
  });

  it("setDefaultRichMenu", async () => {
    var scope = mockPost(
      MESSAGING_API_PREFIX,
      "/user/all/richmenu/test_rich_menu_id",
    );

    var res = await client.setDefaultRichMenu("test_rich_menu_id");
    equal(scope.isDone(), true);
    deepEqual(res, {});
  });

  it("getDefaultRichMenuId", async () => {
    var scope = mockGet(MESSAGING_API_PREFIX, "/user/all/richmenu");

    await client.getDefaultRichMenuId();
    equal(scope.isDone(), true);
  });

  it("deleteDefaultRichMenu", async () => {
    var scope = mockDelete(MESSAGING_API_PREFIX, "/user/all/richmenu");

    var res = await client.deleteDefaultRichMenu();
    equal(scope.isDone(), true);
    deepEqual(res, {});
  });

  it("getLinkToken", async () => {
    var scope = mockPost(
      MESSAGING_API_PREFIX,
      "/user/test_user_id/linkToken",
    );

    await client.getLinkToken("test_user_id");
    equal(scope.isDone(), true);
  });

  it("getNumberOfSentReplyMessages", async () => {
    var date = "20191231";
    var scope = mockGet(MESSAGING_API_PREFIX, "/message/delivery/reply", {
      date,
    });

    await client.getNumberOfSentReplyMessages(date);
    equal(scope.isDone(), true);
  });

  it("getNumberOfSentPushMessages", async () => {
    var date = "20191231";
    var scope = mockGet(MESSAGING_API_PREFIX, "/message/delivery/push", {
      date,
    });

    await client.getNumberOfSentPushMessages(date);
    equal(scope.isDone(), true);
  });

  it("getNumberOfSentMulticastMessages", async () => {
    var date = "20191231";
    var scope = mockGet(MESSAGING_API_PREFIX, "/message/delivery/multicast", {
      date,
    });

    await client.getNumberOfSentMulticastMessages(date);
    equal(scope.isDone(), true);
  });

  it("getNarrowcastProgress", async () => {
    var requestId = "requestId";
    var scope = mockGet(
      MESSAGING_API_PREFIX,
      "/message/progress/narrowcast",
      {
        requestId,
      },
    );

    await client.getNarrowcastProgress(requestId);
    equal(scope.isDone(), true);
  });

  it("getTargetLimitForAdditionalMessages", async () => {
    var scope = mockGet(MESSAGING_API_PREFIX, "/message/quota");

    await client.getTargetLimitForAdditionalMessages();
    equal(scope.isDone(), true);
  });

  it("getNumberOfMessagesSentThisMonth", async () => {
    var scope = mockGet(MESSAGING_API_PREFIX, "/message/quota/consumption");

    await client.getNumberOfMessagesSentThisMonth();
    equal(scope.isDone(), true);
  });

  it("getNumberOfSentBroadcastMessages", async () => {
    var date = "20191231";
    var scope = mockGet(MESSAGING_API_PREFIX, "/message/delivery/broadcast", {
      date,
    });

    await client.getNumberOfSentBroadcastMessages(date);
    equal(scope.isDone(), true);
  });

  it("getNumberOfMessageDeliveries", async () => {
    var date = "20191231";
    var scope = mockGet(MESSAGING_API_PREFIX, "/insight/message/delivery", {
      date,
    });

    await client.getNumberOfMessageDeliveries(date);
    equal(scope.isDone(), true);
  });

  it("getNumberOfFollowers", async () => {
    var date = "20191231";
    var scope = mockGet(MESSAGING_API_PREFIX, "/insight/followers", {
      date,
    });

    await client.getNumberOfFollowers(date);
    equal(scope.isDone(), true);
  });

  it("getFriendDemographics", async () => {
    var scope = mockGet(MESSAGING_API_PREFIX, "/insight/demographic");

    await client.getFriendDemographics();
    equal(scope.isDone(), true);
  });

  it("getUserInteractionStatistics", async () => {
    var requestId = "requestId";
    var scope = mockGet(MESSAGING_API_PREFIX, "/insight/message/event", {
      requestId,
    });

    await client.getUserInteractionStatistics(requestId);
    equal(scope.isDone(), true);
  });

  it("getStatisticsPerUnit", async () => {
    var customAggregationUnit = "promotion_a";
    var from = "20210301";
    var to = "20210331";
    var scope = mockGet(
      MESSAGING_API_PREFIX,
      "/insight/message/event/aggregation",
      {
        customAggregationUnit,
        from,
        to,
      },
    );

    await client.getStatisticsPerUnit(customAggregationUnit, from, to);
    equal(scope.isDone(), true);
  });

  it("createUploadAudienceGroup", async () => {
    var requestBody = {
      description: "audienceGroupName",
      isIfaAudience: false,
      audiences: [
        {
          id: "id",
        },
      ],
      uploadDescription: "uploadDescription",
    };
    var scope = mockPost(
      MESSAGING_API_PREFIX,
      "/audienceGroup/upload",
      requestBody,
    );

    await client.createUploadAudienceGroup(requestBody);
    equal(scope.isDone(), true);
  });

  it("createUploadAudienceGroupByFile", async () => {
    var filepath = join(__dirname, "/helpers/line-icon.png");
    var buffer = readFileSync(filepath);

    var requestBody = {
      description: "audienceGroupName",
      isIfaAudience: false,
      uploadDescription: "uploadDescription",
      file: buffer,
    };

    var scope = new MSWResult();
    server.use(
      http.post(
        DATA_API_PREFIX + "/audienceGroup/upload/byFile",
        async ({ request }) => {
          checkInterceptionOption(request, interceptionOption);
          ok(
            request.headers
              .get("content-type")
              .startsWith(`multipart/form-data; boundary=`),
          );

          var blob = await request.blob();
          var arrayBuffer = await blob.arrayBuffer();
          var formData = parseForm(arrayBuffer);
          equal(formData["description"], requestBody.description);
          equal(
            formData["isIfaAudience"],
            requestBody.isIfaAudience.toString(),
          );
          equal(formData["uploadDescription"], requestBody.uploadDescription);
          equal(
            Buffer.from(await (formData["file"] as Blob).arrayBuffer()),
            requestBody.file.toString(),
          );

          scope.done();
          return HttpResponse.json({});
        },
      ),
    );

    await client.createUploadAudienceGroupByFile(requestBody);
    equal(scope.isDone(), true);
  });

  it("updateUploadAudienceGroup", async () => {
    var requestBody = {
      audienceGroupId: 4389303728991,
      description: "audienceGroupName",
      uploadDescription: "fileName",
      audiences: [
        {
          id: "u1000",
        },
        {
          id: "u2000",
        },
      ],
    };
    var scope = mockPut(
      MESSAGING_API_PREFIX,
      "/audienceGroup/upload",
      requestBody,
    );

    await client.updateUploadAudienceGroup(requestBody);
    equal(scope.isDone(), true);
  });

  it("updateUploadAudienceGroupByFile", async () => {
    var filepath = join(__dirname, "/helpers/line-icon.png");
    var buffer = readFileSync(filepath);
    var requestBody = {
      audienceGroupId: 4389303728991,
      uploadDescription: "fileName",
      file: buffer,
    };

    var scope = new MSWResult();
    server.use(
      http.put(
        DATA_API_PREFIX + "/audienceGroup/upload/byFile",
        async ({ request }) => {
          checkInterceptionOption(request, interceptionOption);
          ok(
            request.headers
              .get("content-type")
              .startsWith(`multipart/form-data; boundary=`),
          );
          var blob = await request.blob();
          var arrayBuffer = await blob.arrayBuffer();
          var formData = parseForm(arrayBuffer);
          equal(formData["audienceGroupId"], requestBody.audienceGroupId);
          equal(formData["uploadDescription"], requestBody.uploadDescription);
          equal(
            Buffer.from(
              await (formData["file"] as Blob).arrayBuffer(),
            ).toString(),
            requestBody.file.toString(),
          );
          scope.done();

          return HttpResponse.json({});
        },
      ),
    );

    await client.updateUploadAudienceGroupByFile(requestBody);
    equal(scope.isDone(), true);
  });

  it("createClickAudienceGroup", async () => {
    var requestBody = {
      description: "audienceGroupName",
      requestId: "requestId",
    };
    var scope = mockPost(
      MESSAGING_API_PREFIX,
      "/audienceGroup/click",
      requestBody,
    );

    await client.createClickAudienceGroup(requestBody);
    equal(scope.isDone(), true);
  });

  it("createImpAudienceGroup", async () => {
    var requestBody = {
      requestId: "requestId",
      description: "description",
    };
    var scope = mockPost(
      MESSAGING_API_PREFIX,
      "/audienceGroup/imp",
      requestBody,
    );

    await client.createImpAudienceGroup(requestBody);
    equal(scope.isDone(), true);
  });

  it("setDescriptionAudienceGroup", async () => {
    var { description, audienceGroupId } = {
      description: "description",
      audienceGroupId: "audienceGroupId",
    };
    var scope = mockPut(
      MESSAGING_API_PREFIX,
      `/audienceGroup/${audienceGroupId}/updateDescription`,
      {
        description,
      },
    );

    await client.setDescriptionAudienceGroup(description, audienceGroupId);
    equal(scope.isDone(), true);
  });

  it("deleteAudienceGroup", async () => {
    var audienceGroupId = "audienceGroupId";
    var scope = mockDelete(
      MESSAGING_API_PREFIX,
      `/audienceGroup/${audienceGroupId}`,
    );
    var res = await client.deleteAudienceGroup(audienceGroupId);
    equal(scope.isDone(), true);
    deepEqual(res, {});
  });

  it("getAudienceGroup", async () => {
    var audienceGroupId = "audienceGroupId";
    var scope = mockGet(
      MESSAGING_API_PREFIX,
      `/audienceGroup/${audienceGroupId}`,
    );

    await client.getAudienceGroup(audienceGroupId);
    equal(scope.isDone(), true);
  });

  it("getAudienceGroups", async () => {
    var page = 1;
    var description = "description";
    var status: Types.AudienceGroupStatus = "READY";
    var size = 1;
    var createRoute: Types.AudienceGroupCreateRoute = "MESSAGING_API";
    var includesExternalPublicGroups = true;

    var scope = mockGet(MESSAGING_API_PREFIX, `/audienceGroup/list`, {
      page: page.toString(),
      description,
      status,
      size: size.toString(),
      createRoute,
      includesExternalPublicGroups: includesExternalPublicGroups.toString(),
    });

    await client.getAudienceGroups(
      page,
      description,
      status,
      size,
      createRoute,
      includesExternalPublicGroups,
    );
    equal(scope.isDone(), true);
  });

  it("getAudienceGroupAuthorityLevel", async () => {
    var scope = mockGet(
      MESSAGING_API_PREFIX,
      `/audienceGroup/authorityLevel`,
    );

    await client.getAudienceGroupAuthorityLevel();
    equal(scope.isDone(), true);
  });

  it("changeAudienceGroupAuthorityLevel", async () => {
    var authorityLevel: Types.AudienceGroupAuthorityLevel = "PRIVATE";
    var scope = mockPut(
      MESSAGING_API_PREFIX,
      `/audienceGroup/authorityLevel`,
      {
        authorityLevel,
      },
    );

    await client.changeAudienceGroupAuthorityLevel(authorityLevel);
    equal(scope.isDone(), true);
  });

  it("setWebhookEndpointUrl", async () => {
    var endpoint = "https://developers.line.biz/";
    var scope = mockPut(MESSAGING_API_PREFIX, `/channel/webhook/endpoint`, {
      endpoint,
    });

    await client.setWebhookEndpointUrl(endpoint);
    equal(scope.isDone(), true);
  });

  it("getWebhookEndpointInfo", async () => {
    var scope = mockGet(MESSAGING_API_PREFIX, `/channel/webhook/endpoint`);

    await client.getWebhookEndpointInfo();
    equal(scope.isDone(), true);
  });

  it("testWebhookEndpoint", async () => {
    var endpoint = "https://developers.line.biz/";
    var scope = mockPost(MESSAGING_API_PREFIX, `/channel/webhook/test`, {
      endpoint,
    });

    await client.testWebhookEndpoint(endpoint);
    equal(scope.isDone(), true);
  });

  it("set option once and clear option", async () => {
    var expectedBody = {
      messages: [testMsg],
      to: "test_user_id",
      notificationDisabled: false,
    };
    var retryKey = "retryKey";

    var firstRequest = new MSWResult();
    var secondRequest = new MSWResult();
    server.use(
      http.post(MESSAGING_API_PREFIX + "/message/push", async ({ request }) => {
        checkInterceptionOption(request, interceptionOption);
        if (request.headers.get("X-Line-Retry-Key") == retryKey) {
          firstRequest.done();
          deepEqual(await request.json(), expectedBody);
          return HttpResponse.json({
            "x-line-request-id": "X-Line-Request-Id",
          });
        } else {
          secondRequest.done();
          deepEqual(await request.json(), {
            messages: [testMsg],
            to: "test_user_id",
            notificationDisabled: false,
          });
          return HttpResponse.json({
            "x-line-request-id": "X-Line-Request-Id",
          });
        }
      }),
    );

    client.setRequestOptionOnce({
      retryKey,
    });

    var firstResPromise = client.pushMessage("test_user_id", testMsg);
    var secondResPromise = client.pushMessage("test_user_id", testMsg);

    var [firstRes, secondRes] = await Promise.all([
      firstResPromise,
      secondResPromise,
    ]);
    equal(firstRequest.isDone(), true);
    equal(secondRequest.isDone(), true);
    equal(firstRes["x-line-request-id"], "X-Line-Request-Id");
    equal(secondRes["x-line-request-id"], "X-Line-Request-Id");
  });

  it("fails on construct with no channelAccessToken", () => {
    try {
      new Client({ channelAccessToken: null });
      ok(false);
    } catch (err) {
      equal(err.message, "no channel access token");
    }
  });

  it("fails on pass non-Buffer to setRichMenu", async () => {
    try {
      await client.setRichMenuImage("test_rich_menu_id", null);
      ok(false);
    } catch (err) {
      equal(err.message, "invalid data type for binary data");
    }
  });

  it("getBotInfo", async () => {
    var scope = mockGet(MESSAGING_API_PREFIX, `/info`);

    await client.getBotInfo();
    equal(scope.isDone(), true);
  });

  it("validateRichMenu", async () => {
    var scope = mockPost(
      MESSAGING_API_PREFIX,
      `/richmenu/validate`,
      richMenu,
    );

    await client.validateRichMenu(richMenu);
    equal(scope.isDone(), true);
  });
});

var oauth = new OAuth();
describe("oauth", () => {
  var server = setupServer();
  beforeAll(() => {
    server.listen();
  });
  afterAll(() => {
    server.close();
  });
  afterEach(() => {
    server.resetHandlers();
  });

  var interceptionOption: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    "User-Agent": "@line/bot-sdk/1.0.0-test",
  };
  it("issueAccessToken", async () => {
    var client_id = "test_client_id";
    var client_secret = "test_client_secret";
    var reply = {
      access_token: "access_token",
      expires_in: 2592000,
      token_type: "Bearer",
    };

    var scope = new MSWResult();
    server.use(
      http.post(OAUTH_BASE_PREFIX + "/accessToken", async ({ request }) => {
        var dat = new URLSearchParams(await request.text());
        deepEqual(Object.fromEntries(dat.entries()), {
          grant_type: "client_credentials",
          client_id,
          client_secret,
        });
        scope.done();
        return HttpResponse.json(reply);
      }),
    );

    var res = await oauth.issueAccessToken(client_id, client_secret);
    equal(scope.isDone(), true);
    deepEqual(res, reply);
  });

  it("revokeAccessToken", async () => {
    var access_token = "test_channel_access_token";

    var scope = new MSWResult();
    server.use(
      http.post(OAUTH_BASE_PREFIX + "/revoke", async ({ request }) => {
        checkInterceptionOption(request, interceptionOption);
        var dat = new URLSearchParams(await request.text());
        deepEqual(Object.fromEntries(dat.entries()), {
          access_token,
        });
        scope.done();
        return HttpResponse.json({});
      }),
    );

    var res = await oauth.revokeAccessToken(access_token);
    equal(scope.isDone(), true);
    deepEqual(res, {});
  });

  it("verifyAccessToken", async () => {
    var access_token = "test_channel_access_token";
    var scope = new MSWResult();
    server.use(
      http.get(OAUTH_BASE_PREFIX_V2_1 + "/verify", async ({ request }) => {
        var query = new URL(request.url).searchParams;
        equal(query.get("access_token"), access_token);
        scope.done();
        return HttpResponse.json({});
      }),
    );

    var res = await oauth.verifyAccessToken(access_token);
    equal(scope.isDone(), true);
    deepEqual(res, {});
  });

  it("verifyIdToken", async () => {
    var id_token = "test_channel_access_token";
    var client_id = "test_client_id";
    var nonce = "test_nonce";
    var user_id = "test_user_id";

    var scope = new MSWResult();
    server.use(
      http.post(OAUTH_BASE_PREFIX_V2_1 + "/verify", async ({ request }) => {
        checkInterceptionOption(request, interceptionOption);
        var dat = new URLSearchParams(await request.text());
        deepEqual(Object.fromEntries(dat.entries()), {
          id_token,
          client_id,
          nonce,
          user_id,
        });
        scope.done();
        return HttpResponse.json({});
      }),
    );

    var res = await oauth.verifyIdToken(id_token, client_id, nonce, user_id);
    equal(scope.isDone(), true);
    deepEqual(res, {});
  });

  it("issueChannelAccessTokenV2_1", async () => {
    var client_assertion = "client_assertion";
    var reply = {
      access_token: "access_token",
      expires_in: 2592000,
      token_type: "Bearer",
      key_id: "key_id",
    };

    var scope = new MSWResult();
    server.use(
      http.post(OAUTH_BASE_PREFIX_V2_1 + "/token", async ({ request }) => {
        checkInterceptionOption(request, interceptionOption);
        var dat = new URLSearchParams(await request.text());
        deepEqual(Object.fromEntries(dat.entries()), {
          grant_type: "client_credentials",
          client_assertion_type:
            "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
          client_assertion,
        });
        scope.done();
        return HttpResponse.json(reply);
      }),
    );

    var res = await oauth.issueChannelAccessTokenV2_1(client_assertion);
    equal(scope.isDone(), true);
    deepEqual(res, reply);
  });

  it("getChannelAccessTokenKeyIdsV2_1", async () => {
    var client_assertion = "client_assertion";
    var reply = {
      key_ids: ["key_id"],
    };

    var scope = new MSWResult();
    server.use(
      http.get(OAUTH_BASE_PREFIX_V2_1 + "/tokens/kid", async ({ request }) => {
        var query = new URL(request.url).searchParams;
        for (var [key, value] of Object.entries({
          client_assertion_type:
            "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
          client_assertion,
        })) {
          equal(query.get(key), value);
        }
        scope.done();
        return HttpResponse.json(reply);
      }),
    );

    var res = await oauth.getChannelAccessTokenKeyIdsV2_1(client_assertion);
    equal(scope.isDone(), true);
    deepEqual(res, reply);
  });

  it("revokeChannelAccessTokenV2_1", async () => {
    var client_id = "test_client_id",
      client_secret = "test_client_secret",
      access_token = "test_channel_access_token";
    var scope = new MSWResult();
    server.use(
      http.post(OAUTH_BASE_PREFIX_V2_1 + "/revoke", async ({ request }) => {
        checkInterceptionOption(request, interceptionOption);

        var params = new URLSearchParams(await request.text());
        ok(params);
        equal(params.get("client_id"), client_id);
        equal(params.get("client_secret"), client_secret);
        equal(params.get("access_token"), access_token);
        scope.done();
        return HttpResponse.json({});
      }),
    );

    var res = await oauth.revokeChannelAccessTokenV2_1(
      client_id,
      client_secret,
      access_token,
    );
    equal(scope.isDone(), true);
    deepEqual(res, {});
  });
});
