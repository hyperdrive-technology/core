# Runtime Architecture Rules

## Code Organization

1. Follow standard Go project layout:
   ```
   runtime/
   ├── cmd/              # Application entry points
   │   └── inrush/      # Main PLC runtime
   ├── internal/         # Private application code
   │   ├── runtime/     # PLC runtime core
   │   ├── parser/      # IEC 61131-3 parser
   │   ├── websocket/   # WebSocket server
   │   └── db/          # Database access
   ├── pkg/             # Public libraries
   └── test/            # Additional test code
   ```

## Runtime Core

1. Use interfaces for dependency injection
2. Implement clean shutdown handling
3. Support online program changes
4. Use context for cancellation

## PLC Execution

1. Implement scan cycle with configurable timing
2. Support multiple tasks with priorities
3. Handle program versioning
4. Maintain variable quality

## Parser

1. Support IEC 61131-3 languages
2. Generate AST for program analysis
3. Implement proper error handling
4. Support incremental parsing

## WebSocket Communication

1. Use gorilla/websocket
2. Implement heartbeat mechanism
3. Handle reconnections gracefully
4. Use structured message types

## Database

1. Use TimescaleDB for time-series data
2. Implement efficient tag storage
3. Handle data retention policies
4. Use connection pooling

## Error Handling

1. Use proper error types
2. Include context in errors
3. Log errors with appropriate levels
4. Implement graceful degradation

## Testing

1. Write unit tests for core logic
2. Include integration tests
3. Use table-driven tests
4. Mock external dependencies

## Performance

1. Use goroutines appropriately
2. Implement proper synchronization
3. Profile and optimize hot paths
4. Monitor memory usage

## Security

1. Validate all inputs
2. Use proper authentication
3. Implement access control
4. Follow secure coding practices
