#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>
#include "secrets.h"

// ====== PIN ======
#define TRIG_PIN 5
#define ECHO_PIN 18
#define SERVO_PIN 13
#define PIR_PIN 23  

#define OPEN_ANGLE 90
#define CLOSE_ANGLE 0

// ====== WIFI + MQTT ======
WiFiClient espClient;
PubSubClient mqtt(espClient);

// ====== SERVO ======
Servo lidServo;
bool isLidOpen = false;

// ====== RÁC ======
int lastFill = 0;

// ====== WIFI ======
void setupWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) delay(300);
}

// ====== MQTT ======
void setupMQTT() {
  mqtt.setServer(MQTT_SERVER, MQTT_PORT);
  while (!mqtt.connected()) {
    mqtt.connect("bin-001");
    delay(1000);
  }
  mqtt.subscribe("smartbin/bin-001/control");
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String cmd;
  for (int i = 0; i < length; i++) cmd += (char)payload[i];

  if (cmd == "OPEN") {
    lidServo.write(OPEN_ANGLE);
    isLidOpen = true;
  }

  if (cmd == "CLOSE") {
    lidServo.write(CLOSE_ANGLE);
    isLidOpen = false;
  }
}

int measureDistance() {
  digitalWrite(TRIG_PIN, LOW); delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  return duration * 0.034 / 2;
}

void publishTelemetry(int fill) {
  StaticJsonDocument<128> doc;
  doc["fill"] = fill;
  doc["lid"] = isLidOpen;

  char buf[128];
  serializeJson(doc, buf);
  mqtt.publish("smartbin/bin-001/telemetry", buf);
}

void publishEmptied() {
  mqtt.publish("smartbin/bin-001/event", "{ \"event\": \"emptied\" }");
}

// ====== SETUP ======
void setup() {
  Serial.begin(115200);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(PIR_PIN, INPUT);

  lidServo.attach(SERVO_PIN);
  lidServo.write(CLOSE_ANGLE);

  setupWiFi();
  setupMQTT();
  mqtt.setCallback(mqttCallback);
}

// ====== LOOP ======
void loop() {
  if (!mqtt.connected()) setupMQTT();
  mqtt.loop();

  // ====== 1. PIR → PHÁT HIỆN NGƯỜI ======
  bool human = digitalRead(PIR_PIN);

  if (human && !isLidOpen) {
    lidServo.write(OPEN_ANGLE);
    isLidOpen = true;
  }

  if (!human && isLidOpen) {
    lidServo.write(CLOSE_ANGLE);
    isLidOpen = false;
  }

  // ====== 2. HC-SR04 → ĐO RÁC ======
  int dist = measureDistance();
  int fill = map(dist, 40, 5, 0, 100);
  fill = constrain(fill, 0, 100);

  // ====== 3. PHÁT HIỆN ĐỔ RÁC ======
  if (lastFill - fill > 30) {
    publishEmptied();
  }
  lastFill = fill;

  // ====== 4. GỬI MQTT ======
  publishTelemetry(fill);

  delay(300);
}