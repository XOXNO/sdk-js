# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Build Commands
- `npm run build` - Full build pipeline: generates SDK from Swagger, builds types, ESM and CJS bundles
- `npm run build:sdk` - Generates SDK code from Swagger YAML (fetches from https://api.xoxno.com/swagger.yaml)
- `npm run build:types` - Builds TypeScript declarations only
- `npm run build:esm` - Builds ESM bundle
- `npm run build:cjs` - Builds CommonJS bundle

### Development Commands
- `npm test` - Runs Jest tests (looks for files in `**/__tests__/**/*.ts`)
- `npm run lint` - Runs ESLint with auto-fix on all TypeScript files
- `npm run format` - Runs Prettier on all TypeScript files
- `npm run docs` - Generates TypeDoc documentation

### Git Workflow
- `npm run commit` - Use commitizen for conventional commits
- Pre-commit hooks run format, lint, and docs generation
- Pre-push hooks run tests

## Architecture Overview

### SDK Generation
The SDK is auto-generated from the XOXNO API Swagger specification:
1. `src/sdk/parseSwagger.ts` fetches and parses the Swagger YAML
2. Generates `src/sdk/swagger.ts` with typed endpoint definitions
3. `src/sdk/index.ts` builds a dynamic SDK object using the endpoint definitions

### Core Components

**XOXNOClient** (`src/utils/api.ts`):
- Main client class handling HTTP requests to XOXNO API
- Supports mainnet/devnet switching
- Handles authentication via Bearer tokens
- Manages smart contract addresses for different environments

**SDK Builder** (`src/sdk/index.ts`):
- Dynamically constructs SDK methods from Swagger definitions
- Transforms kebab-case paths to camelCase methods
- Handles parameter binding and validation
- Example: `/collection/:collection/profile` becomes `sdk.collection.collection('...').profile()`

**Type System**:
- Imports types from `@xoxno/types` package
- Validates addresses and collection tickers before API calls
- Supports typed request/response handling

### Module Exports
- Main export: SDK builder and client
- Secondary export `/interactor`: Smart contract interaction utilities
- Both ESM and CJS builds supported

### Testing
- Jest with TypeScript support
- Tests located in `__tests__` directories
- Coverage reporting enabled

### Smart Contract Integration
The SDK includes addresses for various XOXNO smart contracts:
- XOXNO_SC: Main marketplace contract
- FM_SC: Frame It marketplace
- Staking_SC: NFT staking
- Manager_SC: Collection management
- P2P_SC: Peer-to-peer trading