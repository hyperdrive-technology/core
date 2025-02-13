# IDE Architecture Rules

## Code Organization

1. Follow Theia extension structure:
   ```
   ide/
   ├── src/
   │   ├── backend/        # Backend extension code
   │   │   └── plc/       # PLC-specific backend
   │   └── frontend/      # Frontend extension code
   │       └── plc/       # PLC-specific frontend
   ├── lib/               # Compiled output
   └── src-gen/           # Generated code
   ```

## Extension Structure

1. Use dependency injection
2. Follow Theia extension patterns
3. Implement proper activation events
4. Use contribution points

## PLC Integration

1. Integrate with PLC runtime via WebSocket
2. Support real-time variable monitoring
3. Implement online program changes
4. Provide debugging capabilities

## Editor Features

1. Implement IEC 61131-3 language support
2. Provide code completion
3. Support syntax highlighting
4. Include code formatting

## Visual Editor

1. Use ReactFlow for visual programming
2. Sync with text editor
3. Support drag and drop
4. Implement undo/redo

## User Interface

1. Follow VS Code UI patterns
2. Use Theia's widget system
3. Support dark/light themes
4. Implement responsive design

## Performance

1. Lazy load extensions
2. Optimize startup time
3. Handle large files efficiently
4. Cache frequently used data

## Error Handling

1. Show error messages in problems view
2. Provide detailed diagnostics
3. Handle connection issues gracefully
4. Log errors for debugging

## State Management

1. Use Theia's state management
2. Handle workspace persistence
3. Sync between views
4. Manage undo/redo stack

## Testing

1. Write unit tests for extensions
2. Include integration tests
3. Test different platforms
4. Mock external services
