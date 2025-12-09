import mqtt from "mqtt/dist/mqtt.js";

export type MqttCallback = (
  type: "fill" | "lid" | "emptied",
  value?: any
) => void;

const MQTT_URL = "ws://test.mosquitto.org:8080/mqtt";
let client: mqtt.MqttClient;

export function connectMQTT(onMessage: MqttCallback) {
  client = mqtt.connect(MQTT_URL, {
    clientId: "web-" + Math.random().toString(16).slice(2),
  });

  client.on("connect", () => {
    client.subscribe("smartbin/bin-001/telemetry");
    client.subscribe("smartbin/bin-001/event");
  });

  client.on("message", (topic, payload) => {
    const data = JSON.parse(payload.toString());

    if (topic.endsWith("telemetry")) {
      onMessage("fill", data.fill);
      onMessage("lid", data.lid);
    }

    if (topic.endsWith("event")) {
      if (data.event === "emptied") {
        onMessage("emptied");
      }
    }
  });

  return client;
}

export function sendLidCommand(cmd: "OPEN" | "CLOSE") {
  if (!client) return;
  client.publish("smartbin/bin-001/control", cmd);
}
