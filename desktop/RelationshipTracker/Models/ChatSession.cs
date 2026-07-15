using Newtonsoft.Json;

namespace RelationshipTracker.Models
{
    public class ChatSession
    {
        [JsonProperty("wxId")] public string WxId { get; set; }
        [JsonProperty("nickname")] public string Nickname { get; set; }
        [JsonProperty("messageCount")] public int MessageCount { get; set; }
        [JsonProperty("dateStart")] public string DateStart { get; set; }
        [JsonProperty("dateEnd")] public string DateEnd { get; set; }
        [JsonProperty("avatarPath")] public string AvatarPath { get; set; }
    }

    public class SessionListResponse
    {
        [JsonProperty("sessions")] public ChatSession[] Sessions { get; set; }
        [JsonProperty("error")] public bool Error { get; set; }
        [JsonProperty("type")] public string ErrorType { get; set; }
        [JsonProperty("message")] public string Message { get; set; }
    }

    public class ExportResponse
    {
        [JsonProperty("messages")] public object[] Messages { get; set; }
        [JsonProperty("error")] public bool Error { get; set; }
        [JsonProperty("message")] public string Message { get; set; }
    }
}
