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
)

func init() {
	prometheus.MustRegister(httpRequestsTotal, httpRequestDuration, httpInFlight)
	prometheus.MustRegister(downloadsTotal, downloadsActive, downloadBytesTotal)
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

