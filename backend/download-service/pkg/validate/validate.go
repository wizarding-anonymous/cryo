package validate

import (
    "sync"

    "github.com/go-playground/validator/v10"
)

var (
    v     *validator.Validate
    vOnce sync.Once
)

// Validator returns a singleton validator instance.
func Validator() *validator.Validate {
    vOnce.Do(func() {
        v = validator.New(validator.WithRequiredStructEnabled())
        // Built-in tags include: required, uuid, uuid4, oneof, min, max, etc.
        // Add custom registrations here if needed.
    })
    return v
}

// Struct validates a struct using the shared validator.
func Struct(s any) error {
    return Validator().Struct(s)
}

