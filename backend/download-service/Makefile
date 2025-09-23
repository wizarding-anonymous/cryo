SHELL := /bin/sh

.PHONY: test cover bench

test:
	go test ./...

cover:
	go test ./... -coverprofile=coverage.out
	go tool cover -func=coverage.out

bench:
	go test -bench=. -benchmem ./internal/services -run=^$

