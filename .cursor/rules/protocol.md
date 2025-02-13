# Protocol Architecture Rules

## Type Definitions

1. Define shared types in protocol package:
   ```
   protocol/
   ├── src/
   │   ├── plc.ts        # PLC-specific types
   │   ├── runtime.ts    # Runtime types
   │   └── websocket.ts  # WebSocket message types
   ```

## PLC Types

1. Use strict typing for all values
2. Include quality information
3. Support all IEC data types
4. Handle timestamps consistently

## WebSocket Messages

1. Define message types:
   ```typescript
   type MessageType =
     | 'subscribe'
     | 'unsubscribe'
     | 'write'
     | 'update'
     | 'onlineChange'
   ```

2. Structure messages consistently:
   ```typescript
   interface Message<T> {
     type: MessageType;
     payload: T;
   }
   ```

## Version Control

1. Use semantic versioning
2. Document breaking changes
3. Maintain backwards compatibility
4. Include migration guides

## Code Generation

1. Generate client code from types
2. Support multiple languages
3. Include validation
4. Generate documentation

## Documentation

1. Document all types
2. Include examples
3. Document breaking changes
4. Maintain changelog

## Validation

1. Use Zod for runtime validation
2. Include type guards
3. Validate message formats
4. Handle invalid data

## Security

1. Validate message sizes
2. Implement rate limiting
3. Handle malformed data
4. Sanitize inputs
