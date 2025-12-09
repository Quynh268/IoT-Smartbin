// ==============================
// 🗑️ SMART BIN FIRMWARE
// Chức năng: Đo mức đầy của thùng rác, gửi dữ liệu qua MQTT,
// cảnh báo khi đầy và ghi lại sự kiện đổ rác
// ==============================

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "secrets.h"

WiFiClient espClient;          // Tạo client WiFi
PubSubClient mqtt(espClient);  // Client MQTT

// Cấu hình chân cảm biến HC-SR04
#define TRIG_PIN 5
#define ECHO_PIN 18

long lastPublish = 0;          // Lưu thời điểm gửi dữ liệu gần nhất
int lastFill = 0;              // Lưu giá trị mức đầy trước đó để phát hiện đổ rác

// ---------- Kết nối WiFi ----------
void setupWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("🔌 Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  Serial.println(" ✅ Connected!");
}

// ---------- Kết nối MQTT ----------
void setupMQTT() {
  mqtt.setServer(MQTT_SERVER, MQTT_PORT);
  while (!mqtt.connected()) {
    Serial.print("🌐 Connecting to MQTT...");
    if (mqtt.connect(DEVICE_ID)) {
      Serial.println(" ✅ connected!");
    } else {
      Serial.print(" ❌ failed, rc=");
      Serial.println(mqtt.state());
      delay(1000);
    }
  }
}

// ---------- Hàm đo khoảng cách từ cảm biến HC-SR04 ----------
int measureDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // Đo thời gian echo phản hồi
  long duration = pulseIn(ECHO_PIN, HIGH);

  // Chuyển thời gian thành khoảng cách (cm)
  int distance = duration * 0.034 / 2;
  return distance;
}

// ---------- Gửi dữ liệu mức đầy lên MQTT ----------
void publishFillLevel(int fill) {
  StaticJsonDocument<128> doc;
  doc["ts"] = millis();                     // Thời điểm gửi (ms)
  doc["fill"] = fill;                       // Phần trăm đầy
  doc["status"] = fill >= 85 ? "FULL" : "NORMAL"; // Gắn nhãn "FULL" nếu >85%

  char buf[128];
  size_t n = serializeJson(doc, buf);

  String topic = "smartbin/" + String(DEVICE_ID) + "/telemetry";
  mqtt.publish(topic.c_str(), buf, n);      // Gửi dữ liệu JSON qua MQTT
  Serial.printf("📡 MQTT -> Fill: %d%%\n", fill);
}

// ---------- Cấu hình khởi động ----------
void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  setupWiFi();
  setupMQTT();
  Serial.println("🚀 SmartBin Ready!");
}

// ---------- Vòng lặp chính ----------
void loop() {
  mqtt.loop(); // Giữ kết nối MQTT

  // Đo khoảng cách và quy đổi ra % đầy (thùng cao 20cm)
  int dist = measureDistance();
  int fill = map(dist, 2, 20, 100, 0); // 2cm = đầy, 20cm = rỗng
  if (fill < 0) fill = 0;
  if (fill > 100) fill = 100;

  // Mỗi 5 giây gửi dữ liệu 1 lần
  if (millis() - lastPublish > 5000) {
    lastPublish = millis();
    publishFillLevel(fill);

    // Phát hiện "đổ rác": khi mức đầy giảm mạnh >30%
    if (lastFill - fill > 30) {
      mqtt.publish("smartbin/bin-001/event", "{\"event\":\"emptied\"}");
      Serial.println("🧹 Event: Rác đã được đổ!");
    }
    lastFill = fill;
  }

  delay(100);
}
