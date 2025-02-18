# Protocol Architecture Rules

## Type Definitions

1. Define shared types in protocol package:
   ```
protocol/
   ├── api/           # OpenAPI definitions
   ├── api-pubsub/    # AsyncAPI definitions
   ├── ide/           # Theia-based IDE (TypeScript)
   └── iec61131/      # Langium-based DSL for IEC 61131-3
   ```
