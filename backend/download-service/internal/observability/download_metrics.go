package observability

// Status labels for the downloads_total metric.
const (
	StatusStarted   = "started"
	StatusCompleted = "completed"
	StatusFailed    = "failed"
	StatusCancelled = "cancelled"
)

// RecordDownloadStatus increments the counter for downloads by status.
func RecordDownloadStatus(status string) {
	downloadsTotal.WithLabelValues(status).Inc()
}

// IncActiveDownloads increments the gauge for active downloads.
func IncActiveDownloads() {
	downloadsActive.Inc()
}

// DecActiveDownloads decrements the gauge for active downloads.
func DecActiveDownloads() {
	downloadsActive.Dec()
}

// AddDownloadedBytes adds the given amount to the total downloaded bytes counter.
func AddDownloadedBytes(bytes float64) {
	downloadBytesTotal.Add(bytes)
}
