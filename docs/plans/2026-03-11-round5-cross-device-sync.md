# Round 5: Cross-Device Sync

## Feature: Encrypted Peer-to-Peer Sync Between Devices

### Core Functionality
- Sync data between devices without cloud storage
- End-to-end encryption for all sync traffic
- Conflict resolution for concurrent edits
- QR code pairing for device setup

### Implementation Plan

1. **Sync Protocol** (`src/main/sync.ts`)
   - WebRTC for peer-to-peer connections
   - Signal server for initial handshake (optional, can use static IPs)
   - Encrypted data transfer using AES-GCM
   - Delta sync (only changed records)

2. **Pairing System**
   - Generate device public key
   - QR code with device ID + public key
   - Scan to establish trust
   - Mutual authentication

3. **Conflict Resolution**
   - Timestamp-based conflict detection
   - Last-write-wins for most fields
   - Manual review for conflicting categories/amounts

4. **Sync UI**
   - Device management page
   - QR code scanner/generator
   - Sync status indicator
   - Manual sync trigger

### Security
- Keys generated locally, never transmitted
- All data encrypted in transit
- No cloud intermediaries
- Device fingerprinting for trust
