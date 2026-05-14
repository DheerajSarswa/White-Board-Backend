# WebSocket Real-time Canvas Collaboration

This backend now supports real-time collaboration on canvases using WebSocket rooms.

## Features

- **Room-based collaboration**: Each canvas has its own WebSocket room using the canvas ID
- **Authentication**: WebSocket connections require JWT authentication
- **Real-time updates**: Canvas changes are broadcasted to all users in the room
- **User presence**: Track when users join/leave canvas rooms
- **Cursor tracking**: Optional cursor position sharing for better collaboration

## WebSocket Events

### Client to Server Events

#### Authentication
- **Connection**: Include JWT token in handshake auth
  ```javascript
  const socket = io('http://localhost:3030', {
    auth: {
      token: 'your-jwt-token'
    }
  });
  ```

#### Room Management
- **join-canvas**: Join a canvas room (requires access permission)
  ```javascript
  socket.emit('join-canvas', canvasId);
  ```

- **leave-canvas**: Leave a canvas room
  ```javascript
  socket.emit('leave-canvas', canvasId);
  ```

#### Canvas Updates
- **canvas-update**: Send canvas element updates
  ```javascript
  socket.emit('canvas-update', {
    canvasId: 'canvas-id',
    elements: [...canvasElements]
  });
  ```

#### Optional Features
- **cursor-move**: Share cursor position (for collaborative editing)
  ```javascript
  socket.emit('cursor-move', {
    canvasId: 'canvas-id',
    position: { x: 100, y: 200 }
  });
  ```

- **user-presence**: Update user presence status
  ```javascript
  socket.emit('user-presence', {
    canvasId: 'canvas-id',
    action: 'join' // or 'leave'
  });
  ```

### Server to Client Events

#### Canvas Updates
- **canvas-updated**: Receive canvas updates from other users
  ```javascript
  socket.on('canvas-updated', (data) => {
    console.log('Canvas updated:', data.elements);
    console.log('Updated by:', data.updatedBy);
    console.log('Timestamp:', data.timestamp);
  });
  ```

#### User Activity
- **user-joined**: Another user joined the canvas
  ```javascript
  socket.on('user-joined', (data) => {
    console.log('User joined:', data.userEmail);
  });
  ```

- **user-left**: A user left the canvas
  ```javascript
  socket.on('user-left', (data) => {
    console.log('User left:', data.userEmail);
  });
  ```

#### Sharing Notifications
- **canvas-shared**: Canvas was shared with another user
  ```javascript
  socket.on('canvas-shared', (data) => {
    console.log('Canvas shared with:', data.sharedWith);
    console.log('Shared by:', data.sharedBy);
  });
  ```

#### Optional Features
- **cursor-moved**: Receive cursor updates from other users
  ```javascript
  socket.on('cursor-moved', (data) => {
    console.log('Cursor moved:', data.position, 'by', data.userEmail);
  });
  ```

- **user-presence-changed**: User presence status changed
  ```javascript
  socket.on('user-presence-changed', (data) => {
    console.log('User presence:', data.userEmail, data.action);
  });
  ```

#### Error Handling
- **error**: Receive error messages
  ```javascript
  socket.on('error', (error) => {
    console.error('WebSocket error:', error.message);
  });
  ```

## Security

- All WebSocket connections require valid JWT authentication
- Users can only join rooms for canvases they have access to (owner or shared with)
- Canvas updates are validated through existing API endpoints

## Usage Flow

1. User loads a canvas page
2. Establish WebSocket connection with JWT token
3. Join the canvas room using `join-canvas` event
4. Listen for `canvas-updated` events to sync changes
5. Send updates via `canvas-update` events
6. Leave room when done using `leave-canvas`

## Integration with Frontend

The frontend should:
1. Connect to WebSocket on canvas page load
2. Join canvas room after successful canvas load
3. Listen for real-time updates and merge with local state
4. Send updates through WebSocket for immediate feedback
5. Handle connection errors and reconnection logic