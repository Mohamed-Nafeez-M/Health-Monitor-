#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <math.h>

// ============================================================
// POWER MOSFET HEALTH DETECTION
// ESP32 DAC -> ADC -> Feature Extraction -> Backend
// ============================================================

// ============================================================
// PIN CONFIGURATION
// ============================================================

#define SIGNAL_OUTPUT_PIN 25   // ESP32 DAC
#define ADC_INPUT_PIN     34   // ESP32 ADC

// Connection:
// GPIO25 (DAC) -------- GPIO34 (ADC)


// ============================================================
// WIFI CONFIGURATION
// ============================================================

const char* WIFI_SSID = "iQOO 7";
const char* WIFI_PASSWORD = "123456789";


// ============================================================
// SERVER CONFIGURATION
// ============================================================

// IMPORTANT:
// Check your PC IP using:
// ipconfig
//
// Current IP from your latest code:
// 10.51.109.163
//
// Backend:
// Port 8080
// API:
// /api/sensor/data

const char* SERVER_URL =
  "http://10.51.109.163:8080/api/sensor/data";


// ============================================================
// ADC / SAMPLING
// ============================================================

const int SAMPLE_RATE = 1000;
const int WINDOW_SIZE = 1000;

const unsigned long SAMPLE_INTERVAL_US = 1000;


// ============================================================
// CONDITION TIMING
// ============================================================

const unsigned long CONDITION_DURATION_MS = 10000;


// ============================================================
// MOSFET CONDITIONS
// ============================================================

enum MosfetState
{
  MOSFET_HEALTHY,
  MOSFET_CRITICAL,
  MOSFET_FAULTY
};

MosfetState currentState = MOSFET_HEALTHY;


// ============================================================
// CONTROL VARIABLES
// ============================================================

bool signalPaused = false;

unsigned long conditionStartTime = 0;
unsigned long lastSampleTime = 0;
unsigned long lastSignalUpdate = 0;
unsigned long lastWiFiCheck = 0;


// ============================================================
// SIGNAL PARAMETERS
// ============================================================

// HEALTHY
const float HEALTHY_PERIOD = 0.50;
const float HEALTHY_DECAY = 0.18;
const float HEALTHY_AMPLITUDE = 0.72;

// CRITICAL
const float CRITICAL_PERIOD = 0.40;
const float CRITICAL_DECAY = 0.12;
const float CRITICAL_AMPLITUDE = 0.95;

// FAULTY
const float FAULTY_PERIOD = 0.28;
const float FAULTY_DECAY = 0.07;
const float FAULTY_AMPLITUDE = 0.55;


// ============================================================
// WAVEFORM
// ============================================================

float waveformTime = 0.0;

const unsigned long SIGNAL_UPDATE_INTERVAL_US = 100;


// ============================================================
// ADC BUFFER
// ============================================================

uint16_t samples[WINDOW_SIZE];

int sampleIndex = 0;


// ============================================================
// FEATURES
// ============================================================

float meanValue = 0.0;
float rmsValue = 0.0;
float peakValue = 0.0;
float standardDeviation = 0.0;
float energyValue = 0.0;
float crestFactor = 0.0;
float eventsPerSecond = 0.0;

int eventCount = 0;


// ============================================================
// EVENT DETECTION THRESHOLDS
// ============================================================

const int THRESHOLD_HIGH = 200;
const int THRESHOLD_LOW = 150;


// ============================================================
// HTTP PAYLOAD
// ============================================================

// 1000 ADC samples + JSON data
static char payload[12000];


// ============================================================
// FUNCTION DECLARATIONS
// ============================================================

void processSerial();

void setCondition(MosfetState newState);

void nextCondition();

const char* getStateName();

void generateSignal();

void calculateFeatures();

int detectEvents();

void printResults();

void printJSON();

void connectWiFi();

void checkWiFi();

int buildPayload();

void sendToDashboard();

float safeNumber(float value);


// ============================================================
// SETUP
// ============================================================

void setup()
{
  Serial.begin(115200);

  delay(1000);

  Serial.println();
  Serial.println("================================================");
  Serial.println("       POWER MOSFET HEALTH DETECTION");
  Serial.println("         ESP32 SIGNAL TEST SYSTEM");
  Serial.println("================================================");

  // ----------------------------------------------------------
  // ADC
  // ----------------------------------------------------------

  pinMode(ADC_INPUT_PIN, INPUT);

  analogReadResolution(12);

  analogSetPinAttenuation(ADC_INPUT_PIN, ADC_11db);


  // ----------------------------------------------------------
  // DAC
  // ----------------------------------------------------------

  dacWrite(SIGNAL_OUTPUT_PIN, 0);


  // ----------------------------------------------------------
  // Random seed
  // ----------------------------------------------------------

  randomSeed(analogRead(ADC_INPUT_PIN));


  // ----------------------------------------------------------
  // Wi-Fi
  // ----------------------------------------------------------

  connectWiFi();


  // ----------------------------------------------------------
  // Start HEALTHY
  // ----------------------------------------------------------

  setCondition(MOSFET_HEALTHY);


  // ----------------------------------------------------------
  // INFORMATION
  // ----------------------------------------------------------

  Serial.println();

  Serial.println("HARDWARE:");
  Serial.println("GPIO25 (DAC) -----> GPIO34 (ADC)");

  Serial.println();

  Serial.println("SAMPLING:");
  Serial.println("Rate   : 1000 Hz");
  Serial.println("Window : 1000 samples");
  Serial.println("Time   : 1 second");

  Serial.println();

  Serial.println("AUTOMATIC CONDITIONS:");
  Serial.println("HEALTHY  -> 10 sec");
  Serial.println("CRITICAL -> 10 sec");
  Serial.println("FAULTY   -> 10 sec");

  Serial.println();

  Serial.println("SERIAL COMMANDS:");
  Serial.println("H = HEALTHY");
  Serial.println("C = CRITICAL");
  Serial.println("F = FAULTY");
  Serial.println("N = NEXT");
  Serial.println("P = PAUSE");
  Serial.println("R = RESUME");

  Serial.println();

  Serial.println("SERVER:");
  Serial.println(SERVER_URL);

  Serial.println();

  Serial.println("================================================");
}


// ============================================================
// MAIN LOOP
// ============================================================

void loop()
{
  // ----------------------------------------------------------
  // Serial commands
  // ----------------------------------------------------------

  processSerial();


  // ----------------------------------------------------------
  // Check Wi-Fi
  // ----------------------------------------------------------

  checkWiFi();


  // ----------------------------------------------------------
  // Automatic condition change
  // ----------------------------------------------------------

  if (!signalPaused)
  {
    if (millis() - conditionStartTime >= CONDITION_DURATION_MS)
    {
      nextCondition();
    }
  }


  // ----------------------------------------------------------
  // Generate DAC signal
  // ----------------------------------------------------------

  if (!signalPaused)
  {
    generateSignal();
  }


  // ----------------------------------------------------------
  // ADC sampling
  // ----------------------------------------------------------

  if (!signalPaused)
  {
    unsigned long currentTime = micros();

    if (currentTime - lastSampleTime >= SAMPLE_INTERVAL_US)
    {
      lastSampleTime = currentTime;

      samples[sampleIndex] = analogRead(ADC_INPUT_PIN);

      sampleIndex++;


      // ------------------------------------------------------
      // Complete 1-second window
      // ------------------------------------------------------

      if (sampleIndex >= WINDOW_SIZE)
      {
        sampleIndex = 0;


        // Calculate features
        calculateFeatures();


        // Print serial information
        printResults();

        printJSON();


        // Send to backend
        sendToDashboard();


        // Resynchronize timing
        lastSampleTime = micros();
        lastSignalUpdate = micros();
      }
    }
  }
}


// ============================================================
// WIFI CONNECTION
// ============================================================

void connectWiFi()
{
  Serial.println();
  Serial.println("Connecting to Wi-Fi...");

  Serial.print("SSID: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;

  while (WiFi.status() != WL_CONNECTED && attempts < 30)
  {
    delay(500);

    Serial.print(".");

    attempts++;
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED)
  {
    Serial.println("Wi-Fi connected!");

    Serial.print("ESP32 IP: ");
    Serial.println(WiFi.localIP());

    Serial.print("RSSI: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");

    Serial.print("Server: ");
    Serial.println(SERVER_URL);
  }
  else
  {
    Serial.println("Wi-Fi connection failed.");

    Serial.println("Signal processing will continue locally.");
  }
}


// ============================================================
// WIFI CHECK
// ============================================================

void checkWiFi()
{
  if (millis() - lastWiFiCheck < 5000)
  {
    return;
  }

  lastWiFiCheck = millis();

  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println();
    Serial.println("Wi-Fi disconnected. Reconnecting...");

    WiFi.disconnect();

    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }
}


// ============================================================
// SERIAL COMMANDS
// ============================================================

void processSerial()
{
  if (!Serial.available())
  {
    return;
  }

  char command = toupper(Serial.read());


  if (command == 'H')
  {
    setCondition(MOSFET_HEALTHY);
  }

  else if (command == 'C')
  {
    setCondition(MOSFET_CRITICAL);
  }

  else if (command == 'F')
  {
    setCondition(MOSFET_FAULTY);
  }

  else if (command == 'N')
  {
    nextCondition();
  }

  else if (command == 'P')
  {
    signalPaused = true;

    dacWrite(SIGNAL_OUTPUT_PIN, 0);

    Serial.println();
    Serial.println(">>> SIGNAL PAUSED");
    Serial.println();
  }

  else if (command == 'R')
  {
    signalPaused = false;

    waveformTime = 0.0;

    conditionStartTime = millis();

    lastSampleTime = micros();

    lastSignalUpdate = micros();

    Serial.println();
    Serial.println(">>> SIGNAL RESUMED");
    Serial.println();
  }
}


// ============================================================
// SET CONDITION
// ============================================================

void setCondition(MosfetState newState)
{
  currentState = newState;

  conditionStartTime = millis();

  waveformTime = 0.0;

  sampleIndex = 0;


  Serial.println();
  Serial.println("========================================");


  if (currentState == MOSFET_HEALTHY)
  {
    Serial.println("       MOSFET CONDITION: HEALTHY");

    Serial.println("========================================");

    Serial.println("Stable switching envelope");
  }

  else if (currentState == MOSFET_CRITICAL)
  {
    Serial.println("       MOSFET CONDITION: CRITICAL");

    Serial.println("========================================");

    Serial.println("Higher amplitude / faster switching");
  }

  else
  {
    Serial.println("       MOSFET CONDITION: FAULTY");

    Serial.println("========================================");

    Serial.println("Irregular switching envelope");
  }

  Serial.println();
}


// ============================================================
// NEXT CONDITION
// ============================================================

void nextCondition()
{
  if (currentState == MOSFET_HEALTHY)
  {
    setCondition(MOSFET_CRITICAL);
  }

  else if (currentState == MOSFET_CRITICAL)
  {
    setCondition(MOSFET_FAULTY);
  }

  else
  {
    setCondition(MOSFET_HEALTHY);
  }
}


// ============================================================
// GET STATE NAME
// ============================================================

const char* getStateName()
{
  if (currentState == MOSFET_HEALTHY)
    return "HEALTHY";

  if (currentState == MOSFET_CRITICAL)
    return "CRITICAL";

  return "FAULTY";
}


// ============================================================
// SIGNAL GENERATOR
// ============================================================

void generateSignal()
{
  unsigned long currentTime = micros();

  if (currentTime - lastSignalUpdate <
      SIGNAL_UPDATE_INTERVAL_US)
  {
    return;
  }

  lastSignalUpdate = currentTime;


  float period;
  float decay;
  float amplitude;


  // ----------------------------------------------------------
  // Select condition parameters
  // ----------------------------------------------------------

  if (currentState == MOSFET_HEALTHY)
  {
    period = HEALTHY_PERIOD;
    decay = HEALTHY_DECAY;
    amplitude = HEALTHY_AMPLITUDE;
  }

  else if (currentState == MOSFET_CRITICAL)
  {
    period = CRITICAL_PERIOD;
    decay = CRITICAL_DECAY;
    amplitude = CRITICAL_AMPLITUDE;
  }

  else
  {
    period = FAULTY_PERIOD;
    decay = FAULTY_DECAY;
    amplitude = FAULTY_AMPLITUDE;
  }


  // ----------------------------------------------------------
  // Advance waveform
  // ----------------------------------------------------------

  waveformTime +=
    SIGNAL_UPDATE_INTERVAL_US / 1000000.0;


  if (waveformTime >= period)
  {
    waveformTime = 0.0;
  }


  float position = waveformTime / period;

  float envelope;


  // ----------------------------------------------------------
  // Fast rise
  // ----------------------------------------------------------

  if (position < 0.04)
  {
    envelope = position / 0.04;
  }

  // ----------------------------------------------------------
  // Exponential decay
  // ----------------------------------------------------------

  else
  {
    float decayTime =
      waveformTime - (period * 0.04);

    envelope = exp(-decayTime / decay);
  }


  // ----------------------------------------------------------
  // Apply amplitude
  // ----------------------------------------------------------

  float signal = envelope * amplitude;


  // ----------------------------------------------------------
  // Faulty distortion
  // ----------------------------------------------------------

  if (currentState == MOSFET_FAULTY)
  {
    float disturbance =
      0.18 * sin(waveformTime * 80.0);

    signal += disturbance;


    // Random spike
    if (random(0, 1000) < 8)
    {
      signal += 0.20;
    }
  }


  // ----------------------------------------------------------
  // Limit signal
  // ----------------------------------------------------------

  signal = constrain(signal, 0.0, 1.0);


  // ----------------------------------------------------------
  // DAC output
  // ----------------------------------------------------------

  int dacValue =
    (int)(signal * 255.0);

  dacWrite(SIGNAL_OUTPUT_PIN, dacValue);
}


// ============================================================
// FEATURE EXTRACTION
// ============================================================

void calculateFeatures()
{
  double sum = 0.0;

  double sumSquares = 0.0;

  peakValue = 0.0;


  // ----------------------------------------------------------
  // Mean / RMS / Peak / Energy
  // ----------------------------------------------------------

  for (int i = 0; i < WINDOW_SIZE; i++)
  {
    double value = samples[i];

    sum += value;

    sumSquares += value * value;


    if (value > peakValue)
    {
      peakValue = value;
    }
  }


  meanValue =
    sum / WINDOW_SIZE;


  rmsValue =
    sqrt(sumSquares / WINDOW_SIZE);


  energyValue =
    sumSquares;


  // ----------------------------------------------------------
  // Standard deviation
  // ----------------------------------------------------------

  double variance = 0.0;


  for (int i = 0; i < WINDOW_SIZE; i++)
  {
    double difference =
      samples[i] - meanValue;

    variance +=
      difference * difference;
  }


  variance /= WINDOW_SIZE;

  standardDeviation =
    sqrt(variance);


  // ----------------------------------------------------------
  // Crest factor
  // ----------------------------------------------------------

  if (rmsValue > 0)
  {
    crestFactor =
      peakValue / rmsValue;
  }
  else
  {
    crestFactor = 0.0;
  }


  // ----------------------------------------------------------
  // Events
  // ----------------------------------------------------------

  eventCount =
    detectEvents();

  eventsPerSecond =
    eventCount;
}


// ============================================================
// EVENT DETECTION
// ============================================================

int detectEvents()
{
  bool signalHigh = false;

  int events = 0;


  for (int i = 0; i < WINDOW_SIZE; i++)
  {
    int value = samples[i];


    // Rising edge
    if (!signalHigh &&
        value >= THRESHOLD_HIGH)
    {
      signalHigh = true;

      events++;
    }


    // Falling edge
    else if (signalHigh &&
             value <= THRESHOLD_LOW)
    {
      signalHigh = false;
    }
  }


  return events;
}


// ============================================================
// PRINT RESULTS
// ============================================================

void printResults()
{
  Serial.println();
  Serial.println("----------------------------------------");
  Serial.println("      POWER MOSFET WINDOW READOUT");
  Serial.println("----------------------------------------");


  Serial.print("MOSFET State       : ");
  Serial.println(getStateName());


  Serial.print("Sampling Rate      : ");
  Serial.print(SAMPLE_RATE);
  Serial.println(" Hz");


  Serial.print("Window Size        : ");
  Serial.print(WINDOW_SIZE);
  Serial.println(" samples");


  Serial.print("Mean               : ");
  Serial.print(meanValue, 2);
  Serial.println(" ADC");


  Serial.print("RMS                : ");
  Serial.print(rmsValue, 2);
  Serial.println(" ADC");


  Serial.print("Peak               : ");
  Serial.print(peakValue, 2);
  Serial.println(" ADC");


  Serial.print("Standard deviation : ");
  Serial.print(standardDeviation, 2);
  Serial.println(" ADC");


  Serial.print("Energy             : ");
  Serial.print(energyValue, 2);
  Serial.println(" ADC^2");


  Serial.print("Crest factor       : ");
  Serial.print(crestFactor, 3);
  Serial.println();


  Serial.print("Events / sec       : ");
  Serial.print(eventsPerSecond, 2);
  Serial.println(" Hz");


  Serial.print("Current event count: ");
  Serial.println(eventCount);


  Serial.println("----------------------------------------");
}


// ============================================================
// SERIAL JSON
// ============================================================

void printJSON()
{
  Serial.print("{");

  Serial.print("\"state\":\"");
  Serial.print(getStateName());
  Serial.print("\",");

  Serial.print("\"samplingRate\":");
  Serial.print(SAMPLE_RATE);
  Serial.print(",");

  Serial.print("\"windowSize\":");
  Serial.print(WINDOW_SIZE);
  Serial.print(",");

  Serial.print("\"mean\":");
  Serial.print(meanValue, 2);
  Serial.print(",");

  Serial.print("\"rms\":");
  Serial.print(rmsValue, 2);
  Serial.print(",");

  Serial.print("\"peak\":");
  Serial.print(peakValue, 2);
  Serial.print(",");

  Serial.print("\"standardDeviation\":");
  Serial.print(standardDeviation, 2);
  Serial.print(",");

  Serial.print("\"energy\":");
  Serial.print(energyValue, 2);
  Serial.print(",");

  Serial.print("\"crestFactor\":");
  Serial.print(crestFactor, 3);
  Serial.print(",");

  Serial.print("\"eventsPerSecond\":");
  Serial.print(eventsPerSecond, 2);
  Serial.print(",");

  Serial.print("\"eventCount\":");
  Serial.print(eventCount);

  Serial.println("}");
}


// ============================================================
// SAFE NUMBER
// ============================================================

float safeNumber(float value)
{
  if (isnan(value) ||
      isinf(value) ||
      value < 0.0f)
  {
    return 0.0f;
  }

  return value;
}


// ============================================================
// BUILD JSON PAYLOAD
// ============================================================

int buildPayload()
{
  int n = snprintf(
    payload,
    sizeof(payload),

    "{"
    "\"samplingRate\":1000,"
    "\"healthState\":\"%s\","
    "\"mean\":%.2f,"
    "\"rms\":%.2f,"
    "\"peak\":%.2f,"
    "\"stdDev\":%.2f,"
    "\"energy\":%.2f,"
    "\"crestFactor\":%.3f,"
    "\"eventsPerSecond\":%.2f,"
    "\"samples\":[",

    getStateName(),
    safeNumber(meanValue),
    safeNumber(rmsValue),
    safeNumber(peakValue),
    safeNumber(standardDeviation),
    safeNumber(energyValue),
    safeNumber(crestFactor),
    safeNumber(eventsPerSecond)
  );


  if (n < 0 ||
      n >= (int)sizeof(payload))
  {
    return -1;
  }


  // ----------------------------------------------------------
  // Add exactly 1000 samples
  // ----------------------------------------------------------

  for (int i = 0; i < WINDOW_SIZE; i++)
  {
    unsigned int value = samples[i];


    if (value > 4095)
    {
      value = 4095;
    }


    int written = snprintf(
      payload + n,
      sizeof(payload) - n,

      (i == 0) ? "%u" : ",%u",

      value
    );


    if (written < 0 ||
        n + written >= (int)sizeof(payload) - 4)
    {
      return -1;
    }


    n += written;
  }


  // ----------------------------------------------------------
  // Close samples array and JSON
  // ----------------------------------------------------------

  int tail =
    snprintf(
      payload + n,
      sizeof(payload) - n,
      "]}"
    );


  if (tail < 0 ||
      n + tail >= (int)sizeof(payload))
  {
    return -1;
  }


  return n + tail;
}


// ============================================================
// SEND DATA TO BACKEND
// ============================================================

void sendToDashboard()
{
  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println("Dashboard: Wi-Fi not connected");

    return;
  }


  // ----------------------------------------------------------
  // Build payload
  // ----------------------------------------------------------

  int length = buildPayload();


  if (length < 0)
  {
    Serial.println(
      "Dashboard: payload buffer overflow"
    );

    return;
  }


  Serial.println();
  Serial.println("========== DASHBOARD SEND ==========");

  Serial.print("Condition: ");
  Serial.println(getStateName());

  Serial.print("Payload size: ");
  Serial.print(length);
  Serial.println(" bytes");

  Serial.print("Sending to: ");
  Serial.println(SERVER_URL);


  // ----------------------------------------------------------
  // HTTP
  // ----------------------------------------------------------

  WiFiClient client;

  HTTPClient http;

  http.setTimeout(8000);


  if (!http.begin(client, SERVER_URL))
  {
    Serial.println(
      "Dashboard: http.begin() failed"
    );

    return;
  }


  http.addHeader(
    "Content-Type",
    "application/json"
  );


  // ----------------------------------------------------------
  // POST
  // ----------------------------------------------------------

  int responseCode =
    http.POST(
      (uint8_t*)payload,
      length
    );


  Serial.print("HTTP response: ");
  Serial.println(responseCode);


  // ----------------------------------------------------------
  // Server response
  // ----------------------------------------------------------

  if (responseCode > 0)
  {
    String response =
      http.getString();

    Serial.print("Server response: ");
    Serial.println(response);
  }
  else
  {
    Serial.print("HTTP error: ");
    Serial.println(
      http.errorToString(responseCode)
    );
  }


  Serial.println(
    "===================================="
  );


  http.end();
}