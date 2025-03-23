/**
 * LINE Messaging API
 * This document describes LINE Messaging API.
 *
 * The version of the OpenAPI document: 0.0.1
 *
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */

/**
 * Create audience for click-based retargeting
 */
export type CreateClickBasedAudienceGroupRequest = {
  /**
   * The audience\'s name. This is case-insensitive, meaning AUDIENCE and audience are considered identical. Max character limit: 120
   *
   * @see <a href="https://developers.line.biz/en/reference/messaging-api/#create-click-audience-group">description Documentation</a>
   */
  description?: string /**/;
  /**
   * The request ID of a broadcast or narrowcast message sent in the past 60 days. Each Messaging API request has a request ID.
   *
   * @see <a href="https://developers.line.biz/en/reference/messaging-api/#create-click-audience-group">requestId Documentation</a>
   */
  requestId?: string /**/;
  /**
   * The URL clicked by the user. If empty, users who clicked any URL in the message are added to the list of recipients. Max character limit: 2,000
   *
   * @see <a href="https://developers.line.biz/en/reference/messaging-api/#create-click-audience-group">clickUrl Documentation</a>
   */
  clickUrl?: string /**/;
};
