# Inrush

Inrush is a modern, open-source PLC runtime with support for IEC 61131-3 programming languages and online changes.

## Features

- IEC 61131-3 programming languages support
- Real-time control and monitoring
- Online program changes (similar to Logix)
- WebSocket-based communication
- Modern React-based UI
- Comprehensive documentation

## Project Structure

```
inrush/
├── apps/
│   ├── runtime/     # Go PLC runtime
│   ├── ui/          # React frontend
│   └── website/     # Marketing site
├── packages/
│   ├── protocol/    # Shared types
│   └── ui-components/
└── docs/           # Documentation
```

## Development

### Prerequisites

- Node.js 18+
- Go 1.21+
- Docker & Docker Compose

### Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/inrush-io/inrush.git
   cd inrush
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development environment:
   ```bash
   docker-compose up
   ```

4. Access the applications:
   - UI: http://localhost:8080
   - Documentation: http://localhost:3002
   - Website: http://localhost:3001

### Development Commands

- `npm run dev` - Start all applications in development mode
- `npm run build` - Build all applications
- `npm run test` - Run tests
- `npm run lint` - Run linting
- `npm run clean` - Clean build artifacts

## Architecture

### Runtime

The PLC runtime is written in Go and provides:
- IEC 61131-3 program execution
- Real-time I/O handling
- WebSocket server for UI communication
- Online change support

### UI

The web UI is built with:
- React
- React Router v7
- TailwindCSS
- WebSocket communication

### Communication

Communication between the runtime and UI uses:
- WebSocket protocol
- Typed messages (defined in @inrush/protocol)
- Real-time updates

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [IEC 61131-3 Standard](https://webstore.iec.ch/publication/62427)
- [React Router](https://reactrouter.com/)
