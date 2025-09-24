package observability

import (
    "strconv"
    "time"

    "github.com/gin-gonic/gin"
    "github.com/prometheus/client_golang/prometheus"
)

var (
	httpRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests.",
		},
		[]string{"method", "path", "status"},
	)
	httpRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "Histogram of latencies for HTTP requests.",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "path"},
	)
	httpInFlight = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "http_in_flight_requests",
			Help: "Current number of in-flight HTTP requests.",
		},
	)

	downloadsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "downloads_total",
			Help: "Total number of downloads by status.",
		},
		[]string{"status"}, // e.g., started, completed, failed, cancelled
	)
	downloadsActive = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "downloads_active",
			Help: "Current number of active (downloading or paused) downloads.",
		},
	)
	downloadBytesTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "download_bytes_total",
			Help: "Total bytes downloaded by all clients.",
		},
	)

	// Library Service integration metrics
	libraryRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "library_requests_total",
			Help: "Total number of requests to Library Service.",
		},
		[]string{"method", "status"}, // method: CheckOwnership/ListUserGames, status: success/error/circuit_open
	)
	libraryRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "library_request_duration_seconds",
			Help:    "Histogram of latencies for Library Service requests.",
			Buckets: []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10},
		},
		[]string{"method"},
	)
	libraryCircuitBreakerState = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "library_circuit_breaker_state",
			Help: "Current state of Library Service circuit breaker (0=closed, 1=open).",
		},
		[]string{},
	)
)

func init() {
	prometheus.MustRegister(httpRequestsTotal, httpRequestDuration, httpInFlight)
	prometheus.MustRegister(downloadsTotal, downloadsActive, downloadBytesTotal)
	prometheus.MustRegister(libraryRequestsTotal, libraryRequestDuration, libraryCircuitBreakerState)
}

// GinMetrics is a middleware that records Prometheus metrics per request.
func GinMetrics() gin.HandlerFunc {
    return func(c *gin.Context) {
        httpInFlight.Inc()
        start := time.Now()
        c.Next()
        httpInFlight.Dec()

        method := c.Request.Method
        path := c.FullPath()
        if path == "" {
            path = c.Request.URL.Path
        }
        status := strconv.Itoa(c.Writer.Status())
        httpRequestsTotal.WithLabelValues(method, path, status).Inc()
        httpRequestDuration.WithLabelValues(method, path).Observe(time.Since(start).Seconds())
    }
}

// Library Service metrics helpers

func RecordLibraryRequest(method string, status string, duration time.Duration) {
    libraryRequestsTotal.WithLabelValues(method, status).Inc()
    libraryRequestDuration.WithLabelValues(method).Observe(duration.Seconds())
}

func SetLibraryCircuitBreakerState(isOpen bool) {
    if isOpen {
        libraryCircuitBreakerState.WithLabelValues().Set(1)
    } else {
        libraryCircuitBreakerState.WithLabelValues().Set(0)
    }
}

