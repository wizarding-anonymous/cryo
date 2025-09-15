package errors

import "fmt"

type ValidationError struct{ Msg string }
func (e ValidationError) Error() string { return fmt.Sprintf("validation error: %s", e.Msg) }

type DownloadNotFoundError struct{ ID string }
func (e DownloadNotFoundError) Error() string { return fmt.Sprintf("download not found: %s", e.ID) }

type AccessDeniedError struct{ Reason string }
func (e AccessDeniedError) Error() string { return fmt.Sprintf("access denied: %s", e.Reason) }

type FileCorruptedError struct{ Path string }
func (e FileCorruptedError) Error() string { return fmt.Sprintf("file corrupted: %s", e.Path) }

type StorageError struct{ Msg string }
func (e StorageError) Error() string { return fmt.Sprintf("storage error: %s", e.Msg) }

