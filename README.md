# Inrush
Inrush is a modern, open-source PLC runtime with support for IEC 61131-3 programming languages and online changes.

## Features
- Full support for IEC 61131-3 programming languages via Langium-based DSL
- Real-time control and monitoring
- Online program changes (similar to Logix)
- WebSocket-based communication for UI updates
- NATS-based server-to-server communication
- Modern React-based UI with Langium-powered editor
- Extensible architecture with Langium, AsyncAPI, and OpenAPI
- Deployment-ready with Gokrazy and Caddy for SSL
- Comprehensive documentation

## Project Structure
```
inrush/
├── apps/
│   ├── runtime/       # PLC runtime (Go)
│   └── ui/            # IDE + SCADA UI (TanStack Start + tRPC + Shadcn UI)
├── packages/
│   ├── api/           # OpenAPI definitions
│   ├── api-pubsub/    # AsyncAPI definitions
│   ├── ide/           # Theia-based IDE (TypeScript)
│   └── iec61131/      # Langium-based DSL for IEC 61131-3
│       ├── src/
│       │   ├── grammar/ # Langium grammar definition
│       │   ├── ast/     # Generated AST types
│       │   └── main.ts  # Language server entry
├── docs/              # Documentation
└── website/           # Marketing site
```

## Development

### Prerequisites
- Node.js 23.6+
- Go 1.24+
- Docker & Docker Compose
- Gokrazy (for runtime deployment)
- Caddy (for SSL and reverse proxy)

### Getting Started
Clone the repository:

```bash
git clone https://github.com/inrush-io/inrush.git
cd inrush
```
Install dependencies:

```bash
npm install
```
Start the development environment:

```bash
docker-compose up
```
Access the applications:

- UI: http://localhost:8080
- Documentation: http://localhost:3002
- Website: http://localhost:3001
- IDE: http://localhost:3003

## Deployment

### Runtime Deployment with Gokrazy
The Go-based runtime can be deployed to embedded devices using Gokrazy, a minimal Go-only operating system.

Install Gokrazy:

```bash
go install github.com/gokrazy/tools/cmd/gokr-packer@latest
```
Build and deploy the runtime:

```bash
gokr-packer -overwrite=/dev/sdX ./apps/runtime
```
Replace /dev/sdX with the target device (e.g., an SD card for a Raspberry Pi).

Access the runtime on the device's IP address.

### SSL with Caddy
Use Caddy as a reverse proxy to provide SSL for the runtime and UI.

Install Caddy:

```bash
sudo apt install -y caddy
```
Configure Caddy (Caddyfile):

```caddyfile

inrush.example.com {
    reverse_proxy localhost:8080
    tls {
        email your-email@example.com
    }
}

runtime.example.com {
    reverse_proxy localhost:5000
    tls {
        email your-email@example.com
    }
}
Start Caddy:

```bash
sudo systemctl start caddy
```
Your runtime and UI will now be accessible over HTTPS.

## Development Commands
```bash
pnpm run dev    # Start all applications in development mode
pnpm run build  # Build all applications
pnpm run test   # Run tests
pnpm run lint   # Run linting
pnpm run clean  # Clean build artifacts
```

## Architecture

### Runtime
The PLC runtime is written in Go and provides:

- IEC 61131-3 program execution
- Real-time I/O handling
- WebSocket server for UI communication
- NATS for server-to-server communication
- Online change support
- AsyncAPI-defined real-time communication
- Deployment-ready with Gokrazy

### UI
The web UI is built with:

- React
- TanStack Start
- tRPC
- Shadcn UI
- WebSocket communication for real-time updates
- Typed API (defined in @inrush/api)

### IDE
The IDE is based on Theia and provides:

- A modern, browser based, extensible development environment
- Langium-based DSL for IEC 61131-3 programming with full LSP support
- Syntax highlighting, autocompletion, and validation
- AST-based program representation for online changes
- Integration with the runtime for compilation and debugging

## Communication

### Server-to-UI Communication
Protocol: WebSocket
Schema: Defined using AsyncAPI
Purpose: Real-time updates for variable values, program state, and diagnostics

### Server-to-Server Communication
Protocol: NATS
Purpose: Distributed communication between runtime controllers
Features:
- Publish/Subscribe for event-driven messaging
- Queue groups for load balancing

### Shared Types
Tool: Quicktype
Purpose: Generate shared types for both TypeScript and Go
Location: packages/api

## API Documentation
OpenAPI
RESTful APIs for configuration and management are defined using OpenAPI.
Documentation is auto-generated and available at /docs.

### AsyncAPI
Real-time communication (WebSocket and NATS) is defined using AsyncAPI.
Code generation for clients and servers is supported.

## Contributing
Fork the repository
Create your feature branch (git checkout -b feature/amazing-feature)
Commit your changes (git commit -m 'Add some amazing feature')
Push to the branch (git push origin feature/amazing-feature)
Open a Pull Request
License
This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments
- IEC 61131-3 Standard
- TanStack Start (https://tanstack.com/start/latest)
- Langium (https://langium.org/)
- AsyncAPI (https://www.asyncapi.com/)
- OpenAPI (https://www.openapis.org/)
- Theia (https://theia-ide.org/)
- NATS (https://nats.io/)
- Gokrazy (https://gokrazy.org/)
- Caddy (https://caddyserver.com/)
- Quicktype (https://quicktype.io/)
- Shadcn UI (https://ui.shadcn.com/)
- Lucide (https://lucide.dev/)
- Tailwind CSS (https://tailwindcss.com/)
- InfluxDB / Telegraf (https://influxdata.com/)
