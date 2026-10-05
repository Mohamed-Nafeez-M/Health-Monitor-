import { jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import {
  Activity,
  Cable,
  Clock3,
  RotateCw,
  Waves
} from "lucide-react";
import {
  getGetSensorHistoryQueryKey,
  getGetSensorLatestQueryKey,
  useGetSensorHistory,
  useGetSensorLatest
} from "@workspace/api-client-react";
function formatNumber(value, digits = 2) {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString(void 0, { minimumFractionDigits: digits, maximumFractionDigits: digits }) : "\u2014";
}
function formatEnergy(value) {
  return typeof value === "number" && Number.isFinite(value) ? new Intl.NumberFormat(void 0, {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value) : "\u2014";
}
function formatTime(value) {
  if (!value) return "\u2014";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
}
const STALE_AFTER_MS = 8e3;
function getWaveformHealth(snapshot, socketState = "connected", now = Date.now(), measurementIsFresh = true) {
  if (!snapshot || snapshot.sampleCount !== 1e3 || snapshot.samples?.length !== 1e3 || !snapshot.samples?.every(
    (sample) => Number.isFinite(sample) && sample >= 0 && sample <= 4095
  )) {
    return {
      status: "FAULTY",
      reason: "The current window is missing, incomplete, or contains invalid ADC samples."
    };
  }

  const timestamp = Date.parse(snapshot.timestamp);
  const isStale = typeof measurementIsFresh === "boolean" ? !measurementIsFresh : (!Number.isFinite(timestamp) || (Number.isFinite(now) && now - timestamp >= STALE_AFTER_MS));
  if (socketState !== "connected" || snapshot.connectionStatus === "DISCONNECTED" || isStale) {
    return {
      status: "FAULTY",
      reason: "The live stream is disconnected or the latest window is stale."
    };
  }

  if (snapshot.signalStatus !== "DETECTED") {
    return {
      status: "FAULTY",
      reason: "No envelope signal is detected in the current window from the controller."
    };
  }

  if (snapshot.healthState === "FAULTY") {
    return {
      status: "FAULTY",
      reason: "Controller reported faulty signal (F)."
    };
  }

  const criticalConditions = [];
  if (snapshot.healthState === "CRITICAL") {
    criticalConditions.push("controller reported critical state (C)");
  }
  if (snapshot.peak >= 3686) {
    criticalConditions.push("peak is at least 90% of the 12-bit ADC range");
  }
  if (snapshot.crestFactor >= 6) {
    criticalConditions.push("crest factor is at least 6.0");
  }
  if (snapshot.eventsPerSecond >= 8) {
    criticalConditions.push("event rate is at least 8 per second");
  }

  if (criticalConditions.length > 0) {
    return {
      status: "CRITICAL",
      reason: criticalConditions.join("; ")
    };
  }

  return {
    status: "HEALTHY",
    reason: snapshot.healthState === "HEALTHY"
      ? "ESP32 reported healthy wave (H)."
      : "Healthy wave from the controller; normal envelope signal without clipping or abnormal rate."
  };
}
function SignalBadge({ status, testId = "status-signal" }) {
  const detected = status === "DETECTED";
  return /* @__PURE__ */ jsxs("span", {
    className: `signal-badge ${detected ? "signal-badge--on" : "signal-badge--off"}`, "data-testid": testId, children: [
    /* @__PURE__ */ jsx("span", { className: "status-dot" }),
      status || "\u2014"
    ]
  });
}
function Waveform({ samples }) {
  const validSamples = samples?.length === 1e3 ? samples : [];
  const { line, area, labels } = useMemo(() => {
    if (!validSamples.length) return { line: "", area: "", labels: ["\u2014", "\u2014", "\u2014"] };
    const min = Math.min(...validSamples);
    const max = Math.max(...validSamples);
    const span = Math.max(max - min, 1);
    const points = validSamples.map((sample, index) => ({
      x: 44 + index / 999 * 924,
      y: 24 + (max - sample) / span * 204
    }));
    const path = points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
    return {
      line: path,
      area: `${path} L968,228 L44,228 Z`,
      labels: [formatNumber(max, 0), formatNumber((max + min) / 2, 0), formatNumber(min, 0)]
    };
  }, [validSamples]);
  return /* @__PURE__ */ jsx("div", {
    className: "waveform-wrap", "data-testid": "display-live-waveform", children: /* @__PURE__ */ jsxs("svg", {
      className: "waveform", viewBox: "0 0 1000 282", role: "img", "aria-label": "Live envelope waveform, one second at 1000 hertz", children: [
    /* @__PURE__ */ jsxs("defs", {
        children: [
      /* @__PURE__ */ jsxs("linearGradient", {
          id: "wave-fill", x1: "0", x2: "0", y1: "0", y2: "1", children: [
        /* @__PURE__ */ jsx("stop", { offset: "0%", stopColor: "#78d4aa", stopOpacity: ".24" }),
        /* @__PURE__ */ jsx("stop", { offset: "100%", stopColor: "#78d4aa", stopOpacity: "0" })
          ]
        }),
      /* @__PURE__ */ jsx("filter", { id: "wave-soft", children: /* @__PURE__ */ jsx("feGaussianBlur", { stdDeviation: "3" }) })
        ]
      }),
        [24, 75, 126, 177, 228].map((y, i) => /* @__PURE__ */ jsxs("g", {
          children: [
      /* @__PURE__ */ jsx("line", { x1: "44", x2: "968", y1: y, y2: y, className: "chart-grid" }),
            i < 3 && /* @__PURE__ */ jsx("text", { x: "34", y: y + 4, textAnchor: "end", className: "chart-label", children: labels[i] })
          ]
        }, y)),
        [44, 275, 506, 737, 968].map((x, i) => /* @__PURE__ */ jsxs("g", {
          children: [
      /* @__PURE__ */ jsx("line", { x1: x, x2: x, y1: "24", y2: "228", className: "chart-grid chart-grid--vertical" }),
      /* @__PURE__ */ jsx("text", { x, y: "253", textAnchor: i === 0 ? "start" : i === 4 ? "end" : "middle", className: "chart-label", children: (i * 0.25).toFixed(2) })
          ]
        }, x)),
        line && /* @__PURE__ */ jsx("path", { d: line, fill: "none", stroke: "#78d4aa", strokeWidth: "8", opacity: ".24", filter: "url(#wave-soft)" }),
        area && /* @__PURE__ */ jsx("path", { d: area, fill: "url(#wave-fill)" }),
        line && /* @__PURE__ */ jsx("path", { d: line, fill: "none", stroke: "#82deb3", strokeWidth: "2.2", strokeLinejoin: "round", strokeLinecap: "round", vectorEffect: "non-scaling-stroke" }),
        !line && /* @__PURE__ */ jsx("text", { x: "506", y: "130", textAnchor: "middle", className: "chart-empty", children: "Awaiting 1,000-sample window" }),
    /* @__PURE__ */ jsx("text", { x: "506", y: "278", textAnchor: "middle", className: "chart-axis-title", children: "TIME \xB7 SECONDS" }),
    /* @__PURE__ */ jsx("text", { x: "14", y: "130", textAnchor: "middle", className: "chart-axis-title", transform: "rotate(-90 14 130)", children: "ADC AMPLITUDE" })
      ]
    })
  });
}
function Metric({ label, value, unit, emphasis = false, title }) {
  return /* @__PURE__ */ jsxs("div", {
    className: `metric ${emphasis ? "metric--emphasis" : ""}`, title, "data-testid": `metric-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`, children: [
    /* @__PURE__ */ jsx("div", { className: "metric-label", children: label }),
    /* @__PURE__ */ jsxs("div", {
      className: "metric-reading", children: [
        value,
      /* @__PURE__ */ jsx("span", { children: unit })
      ]
    })
    ]
  });
}
function Dashboard() {
  const queryClient = useQueryClient();
  const latestQuery = useGetSensorLatest({ query: { queryKey: getGetSensorLatestQueryKey(), refetchOnWindowFocus: false } });
  const historyQuery = useGetSensorHistory({ limit: 20 }, { query: { queryKey: getGetSensorHistoryQueryKey({ limit: 20 }), refetchOnWindowFocus: false } });
  const [socketState, setSocketState] = useState("connecting");
  const [snapshot, setSnapshot] = useState();
  const [now, setNow] = useState(() => Date.now());
  const [lastReceivedAt, setLastReceivedAt] = useState(Number.NaN);
  const hadConnection = useRef(false);
  useEffect(() => {
    if (latestQuery.data && !snapshot) {
      setSnapshot(latestQuery.data);
      setLastReceivedAt(Date.parse(latestQuery.data.timestamp));
    }
  }, [latestQuery.data, snapshot]);
  useEffect(() => {
    const socket = io(window.location.origin, {
      path: "/api/socket.io",
      transports: ["websocket"]
    });
    socket.on("connect", () => {
      setSocketState("connected");
      if (hadConnection.current) {
        void queryClient.invalidateQueries({ queryKey: getGetSensorLatestQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetSensorHistoryQueryKey({ limit: 20 }) });
      }
      hadConnection.current = true;
    });
    socket.on("disconnect", () => setSocketState("disconnected"));
    socket.on("connect_error", () => setSocketState("disconnected"));
    socket.on("sensor:update", (payload) => {
      if (!payload || payload.samples?.length !== 1e3) return;
      setSnapshot(payload);
      setLastReceivedAt(Date.now());
      queryClient.setQueryData(getGetSensorLatestQueryKey(), payload);
      const key = getGetSensorHistoryQueryKey({ limit: 20 });
      queryClient.setQueryData(key, (previous) => {
        if (!previous) return previous;
        const measurement = {
          id: payload.id,
          timestamp: payload.timestamp,
          samplingRate: payload.samplingRate,
          sampleCount: payload.sampleCount,
          rms: payload.rms,
          peak: payload.peak,
          energy: payload.energy,
          eventsPerSecond: payload.eventsPerSecond,
          signalStatus: payload.signalStatus,
          healthState: payload.healthState ?? null
        };
        return { ...previous, measurements: [measurement, ...previous.measurements.filter((item) => item.id !== measurement.id)].slice(0, 20) };
      });
    });
    return () => {
      socket.disconnect();
    };
  }, [queryClient]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1e3);
    return () => clearInterval(timer);
  }, []);
  const current = snapshot ?? latestQuery.data;
  const measurementIsFresh = Number.isFinite(lastReceivedAt) && now - lastReceivedAt < STALE_AFTER_MS;
  const sourceMode = socketState === "connected" && measurementIsFresh ? current?.connectionStatus ?? "DISCONNECTED" : "DISCONNECTED";
  const waveformHealth = getWaveformHealth(current, socketState, now, measurementIsFresh);
  const history = historyQuery.data?.measurements ?? [];
  return /* @__PURE__ */ jsxs("main", {
    className: "dashboard-shell", children: [
    /* @__PURE__ */ jsxs("header", {
      className: "topbar", children: [
      /* @__PURE__ */ jsxs("div", {
        className: "brand-block", children: [
        /* @__PURE__ */ jsx("div", { className: "brand-mark", children: /* @__PURE__ */ jsx(Activity, { size: 19, strokeWidth: 2.1 }) }),
        /* @__PURE__ */ jsxs("div", {
          children: [
          /* @__PURE__ */ jsxs("div", {
            className: "brand-name", children: [
              "FIELDNOTE ",
            /* @__PURE__ */ jsx("span", { children: "/ SIGNAL LAB" })
            ]
          }),
          /* @__PURE__ */ jsx("div", { className: "brand-subtitle", children: "ESP32 ENVELOPE VALIDATION" })
          ]
        })
        ]
      }),
      /* @__PURE__ */ jsxs("div", {
        className: "topbar-meta", children: [
        /* @__PURE__ */ jsxs("div", {
          className: `transport-indicator transport-${socketState}`, "data-testid": "status-dashboard-transport", children: [
          /* @__PURE__ */ jsx("span", { className: "transport-light" }),
          /* @__PURE__ */ jsx("span", { children: socketState === "connected" ? "STREAM LIVE" : socketState === "connecting" ? "RECONNECTING" : "STREAM OFFLINE" })
          ]
        }),
        /* @__PURE__ */ jsx("span", { className: "topbar-divider" }),
        /* @__PURE__ */ jsxs("span", {
          className: "session-tag", children: [
          /* @__PURE__ */ jsx(Cable, { size: 14 }),
            " SOCKET.IO"
          ]
        })
        ]
      })
      ]
    }),
    /* @__PURE__ */ jsxs("div", {
      className: "main-content", children: [
      /* @__PURE__ */ jsxs("section", {
        className: "page-intro", children: [
        /* @__PURE__ */ jsxs("div", {
          children: [
          /* @__PURE__ */ jsxs("div", {
            className: "eyebrow", children: [
            /* @__PURE__ */ jsx("span", { className: "eyebrow-line" }),
              " BENCH INSTRUMENT / 01"
            ]
          }),
          /* @__PURE__ */ jsxs("h1", {
            children: [
              "Signal ",
            /* @__PURE__ */ jsx("span", { children: "overview" })
            ]
          }),
          /* @__PURE__ */ jsx("p", { className: "intro-copy", children: "Live envelope processing from the current measurement window." })
          ]
        }),
        /* @__PURE__ */ jsxs("button", {
          className: "refresh-button", onClick: () => {
            void latestQuery.refetch();
            void historyQuery.refetch();
          }, "data-testid": "button-refresh-measurements", children: [
          /* @__PURE__ */ jsx(RotateCw, { size: 15, className: latestQuery.isFetching || historyQuery.isFetching ? "rotate-icon" : "" }),
          /* @__PURE__ */ jsx("span", { children: "Refresh readings" })
          ]
        })
        ]
      }),
      /* @__PURE__ */ jsxs("section", {
        className: "source-strip", "aria-label": "Signal source and status", children: [
        /* @__PURE__ */ jsxs("div", {
          className: "source-cell", children: [
          /* @__PURE__ */ jsx("div", { className: "source-icon", children: /* @__PURE__ */ jsx(Waves, { size: 17 }) }),
          /* @__PURE__ */ jsxs("div", {
            children: [
            /* @__PURE__ */ jsx("div", { className: "source-label", children: "SIGNAL SOURCE" }),
            /* @__PURE__ */ jsx("div", { className: "source-value", children: "ESP32 envelope pipeline" })
            ]
          })
          ]
        }),
        /* @__PURE__ */ jsx("div", { className: "source-divider" }),
        /* @__PURE__ */ jsx("div", {
          className: "source-cell source-cell--mode", children: /* @__PURE__ */ jsxs("div", {
            children: [
          /* @__PURE__ */ jsx("div", { className: "source-label", children: "ESP32 STATUS" }),
          /* @__PURE__ */ jsx("div", { className: "source-value", "data-testid": "display-source-mode", children: sourceMode })
            ]
          })
        }),
        /* @__PURE__ */ jsx("div", {
          className: "source-cell source-cell--signal", children: /* @__PURE__ */ jsxs("div", {
            children: [
          /* @__PURE__ */ jsx("div", { className: "source-label", children: "SIGNAL STATE" }),
          /* @__PURE__ */ jsx("div", { className: "source-value", children: /* @__PURE__ */ jsx(SignalBadge, { status: current?.signalStatus ?? "\u2014" }) })
            ]
          })
        }),
        /* @__PURE__ */ jsx("div", { className: "source-strip-footnote", "data-testid": "text-signal-provenance", children: "Representative ESP32-generated envelope waveform \u2014 not a piezo sensor PWM output." })
        ]
      }),
      /* @__PURE__ */ jsxs("div", {
        className: "primary-grid", children: [
        /* @__PURE__ */ jsxs("section", {
          className: "wave-panel", children: [
          /* @__PURE__ */ jsxs("div", {
            className: "wave-panel-head", children: [
            /* @__PURE__ */ jsxs("div", {
              children: [
              /* @__PURE__ */ jsxs("div", {
                className: "section-kicker", children: [
                /* @__PURE__ */ jsx("span", { className: `live-mark ${socketState === "connected" ? "live-mark--active" : ""}` }),
                  " LIVE MEASUREMENT"
                ]
              }),
              /* @__PURE__ */ jsx("h2", { children: "Live envelope waveform" })
              ]
            }),
            /* @__PURE__ */ jsxs("div", {
              className: "wave-panel-tools", children: [
              /* @__PURE__ */ jsxs(
                "div",
                {
                  className: `wave-health wave-health--${waveformHealth.status.toLowerCase()}`,
                  title: waveformHealth.reason,
                  "aria-label": `Waveform health: ${waveformHealth.status}. ${waveformHealth.reason}`,
                  role: "status",
                  "data-testid": "status-waveform-health",
                  children: [
                    /* @__PURE__ */ jsx("span", { className: "wave-health-dot" }),
                    /* @__PURE__ */ jsxs("span", {
                    children: [
                      /* @__PURE__ */ jsx("span", { className: "wave-health-label", children: "WAVEFORM HEALTH" }),
                      /* @__PURE__ */ jsx("strong", { children: waveformHealth.status })
                    ]
                  })
                  ]
                }
              ),
              /* @__PURE__ */ jsxs("div", {
                className: "window-chip", children: [
                /* @__PURE__ */ jsx("span", { children: "WINDOW" }),
                  " 1.000 ",
                /* @__PURE__ */ jsx("small", { children: "s" })
                ]
              })
              ]
            })
            ]
          }),
          /* @__PURE__ */ jsx(Waveform, { samples: current?.samples }),
          /* @__PURE__ */ jsxs("div", {
            className: "chart-footer", children: [
            /* @__PURE__ */ jsxs("div", {
              className: "chart-legend", children: [
              /* @__PURE__ */ jsx("span", { className: "legend-stroke" }),
                " ENVELOPE AMPLITUDE ",
              /* @__PURE__ */ jsx("span", { className: "legend-count", children: "1,000 SAMPLES" })
              ]
            }),
            /* @__PURE__ */ jsxs("div", {
              className: "chart-footer-right", children: [
              /* @__PURE__ */ jsx("span", { children: "1 kHz" }),
              /* @__PURE__ */ jsx("span", { className: "chart-separator", children: "/" }),
              /* @__PURE__ */ jsx("span", { children: "0\u20131 sec" })
              ]
            })
            ]
          })
          ]
        }),
        /* @__PURE__ */ jsxs("aside", {
          className: "readout-panel", children: [
          /* @__PURE__ */ jsxs("div", {
            className: "readout-head", children: [
            /* @__PURE__ */ jsx("div", { className: "section-kicker", children: "WINDOW READOUT" }),
            /* @__PURE__ */ jsxs("span", {
              className: "readout-index", children: [
                "SNAPSHOT ",
                current ? `#${current.id}` : "\u2014"
              ]
            })
            ]
          }),
            latestQuery.isLoading && !current ? /* @__PURE__ */ jsxs("div", {
              className: "metric-skeletons", "data-testid": "loading-latest", children: [
            /* @__PURE__ */ jsx("i", {}),
            /* @__PURE__ */ jsx("i", {}),
            /* @__PURE__ */ jsx("i", {}),
            /* @__PURE__ */ jsx("i", {})
              ]
            }) : latestQuery.isError && !current ? /* @__PURE__ */ jsxs("div", {
              className: "query-error", "data-testid": "error-latest", children: [
            /* @__PURE__ */ jsx("p", { children: "Latest window unavailable." }),
            /* @__PURE__ */ jsx("button", { onClick: () => void latestQuery.refetch(), "data-testid": "button-retry-latest", children: "Retry latest" })
              ]
            }) : /* @__PURE__ */ jsxs("div", {
              className: "metric-grid", "data-testid": "display-window-metrics", children: [
            /* @__PURE__ */ jsx(Metric, { label: "Sampling rate", value: formatNumber(current?.samplingRate, 0), unit: " Hz" }),
            /* @__PURE__ */ jsx(Metric, { label: "Window size", value: formatNumber(current?.sampleCount, 0), unit: " samples" }),
            /* @__PURE__ */ jsx(Metric, { label: "Mean", value: formatNumber(current?.mean, 2), unit: " ADC" }),
            /* @__PURE__ */ jsx(Metric, { label: "RMS", value: formatNumber(current?.rms, 2), unit: " ADC", emphasis: true }),
            /* @__PURE__ */ jsx(Metric, { label: "Peak", value: formatNumber(current?.peak, 2), unit: " ADC" }),
            /* @__PURE__ */ jsx(Metric, { label: "Standard deviation", value: formatNumber(current?.stdDev, 2), unit: " ADC" }),
            /* @__PURE__ */ jsx(Metric, { label: "Energy", value: formatEnergy(current?.energy), unit: " ADC\xB2", title: `Exact energy: ${formatNumber(current?.energy, 2)} ADC\xB2` }),
            /* @__PURE__ */ jsx(Metric, { label: "Crest factor", value: formatNumber(current?.crestFactor, 3) }),
            /* @__PURE__ */ jsx(Metric, { label: "Events / sec", value: formatNumber(current?.eventsPerSecond, 2), unit: " Hz" }),
            /* @__PURE__ */ jsx(Metric, { label: "Current event count", value: formatNumber(current?.currentEventCount, 0) })
              ]
            }),
          /* @__PURE__ */ jsx("div", { className: "health-rule-note", "data-testid": "text-waveform-health-rules", children: "Waveform health: Healthy for normal controller signal. Critical for peak \u2265 3,686 ADC, crest factor \u2265 6.0, or \u2265 8 events/s. Faulty for no signal, incomplete window, or stale/disconnected stream." }),
          /* @__PURE__ */ jsxs("div", {
              className: "readout-foot", children: [
            /* @__PURE__ */ jsxs("div", {
                children: [
              /* @__PURE__ */ jsx("span", { className: "foot-label", children: "SAMPLE COUNT" }),
              /* @__PURE__ */ jsxs("strong", {
                  "data-testid": "display-sample-count", children: [
                    current?.sampleCount?.toLocaleString() ?? "\u2014",
                    " / 1,000"
                  ]
                })
                ]
              }),
            /* @__PURE__ */ jsxs("div", {
                children: [
              /* @__PURE__ */ jsx("span", { className: "foot-label", children: "LAST UPDATE" }),
              /* @__PURE__ */ jsxs("strong", {
                  "data-testid": "display-last-update", children: [
                /* @__PURE__ */ jsx(Clock3, { size: 12 }),
                    " ",
                    formatTime(current?.timestamp)
                  ]
                })
                ]
              })
              ]
            })
          ]
        })
        ]
      }),
      /* @__PURE__ */ jsxs("section", {
        className: "history-panel", children: [
        /* @__PURE__ */ jsxs("div", {
          className: "history-head", children: [
          /* @__PURE__ */ jsxs("div", {
            children: [
            /* @__PURE__ */ jsx("div", { className: "section-kicker", children: "RECENT WINDOWS" }),
            /* @__PURE__ */ jsx("h2", { children: "Measurement history" })
            ]
          }),
          /* @__PURE__ */ jsxs("div", {
            className: "history-count", "data-testid": "display-history-count", children: [
              history.length.toString().padStart(2, "0"),
              " ",
            /* @__PURE__ */ jsx("span", { children: "RECORDS" })
            ]
          })
          ]
        }),
          historyQuery.isLoading ? /* @__PURE__ */ jsxs("div", {
            className: "history-loading", "data-testid": "loading-history", children: [
          /* @__PURE__ */ jsx("span", {}),
          /* @__PURE__ */ jsx("span", {}),
          /* @__PURE__ */ jsx("span", {}),
          /* @__PURE__ */ jsx("span", {})
            ]
          }) : historyQuery.isError ? /* @__PURE__ */ jsxs("div", {
            className: "history-error", "data-testid": "error-history", children: [
              "History could not be loaded. ",
          /* @__PURE__ */ jsx("button", { onClick: () => void historyQuery.refetch(), "data-testid": "button-retry-history", children: "Try again" })
            ]
          }) : history.length === 0 ? /* @__PURE__ */ jsx("div", { className: "history-empty", "data-testid": "empty-history", children: "No measurement windows have been recorded yet." }) : /* @__PURE__ */ jsx("div", {
            className: "history-scroll", children: /* @__PURE__ */ jsxs("table", {
              className: "history-table", children: [
          /* @__PURE__ */ jsx("thead", {
                children: /* @__PURE__ */ jsxs("tr", {
                  children: [
            /* @__PURE__ */ jsx("th", { children: "Timestamp" }),
            /* @__PURE__ */ jsxs("th", {
                    children: [
                      "RMS ",
              /* @__PURE__ */ jsx("span", { children: "ADC" })
                    ]
                  }),
            /* @__PURE__ */ jsxs("th", {
                    children: [
                      "Peak ",
              /* @__PURE__ */ jsx("span", { children: "ADC" })
                    ]
                  }),
            /* @__PURE__ */ jsxs("th", {
                    children: [
                      "Energy ",
              /* @__PURE__ */ jsx("span", { children: "ADC\xB2" })
                    ]
                  }),
            /* @__PURE__ */ jsxs("th", {
                    children: [
                      "Events / sec ",
              /* @__PURE__ */ jsx("span", { children: "Hz" })
                    ]
                  }),
            /* @__PURE__ */ jsx("th", { children: "Signal status" })
                  ]
                })
              }),
          /* @__PURE__ */ jsx("tbody", {
                children: history.map((item, index) => /* @__PURE__ */ jsxs("tr", {
                  "data-testid": `row-history-${item.id}`, children: [
            /* @__PURE__ */ jsxs("td", {
                    className: "time-cell", children: [
              /* @__PURE__ */ jsx("span", { className: "row-index", children: String(index + 1).padStart(2, "0") }),
                      formatTime(item.timestamp)
                    ]
                  }),
            /* @__PURE__ */ jsx("td", { className: "numeric-cell", children: formatNumber(item.rms, 2) }),
            /* @__PURE__ */ jsx("td", { className: "numeric-cell", children: formatNumber(item.peak, 2) }),
            /* @__PURE__ */ jsx("td", { className: "numeric-cell", title: `${formatNumber(item.energy, 2)} ADC\xB2`, children: formatEnergy(item.energy) }),
            /* @__PURE__ */ jsx("td", { className: "numeric-cell", children: formatNumber(item.eventsPerSecond, 2) }),
            /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx(SignalBadge, { status: item.signalStatus, testId: `status-signal-${item.id}` }) })
                  ]
                }, item.id))
              })
              ]
            })
          })
        ]
      }),
      /* @__PURE__ */ jsxs("footer", {
        className: "footer-line", children: [
        /* @__PURE__ */ jsx("span", { children: "EMBEDDED SIGNAL INSTRUMENTATION" }),
        /* @__PURE__ */ jsx("span", { children: "ADC WINDOW \xB7 1000 SAMPLES \xB7 1000 Hz" })
        ]
      })
      ]
    })
    ]
  });
}
export {
  Dashboard as default
};
