# Garden Planner Backend Service

Enterprise-grade backend service for the Garden Planner application providing secure and scalable garden optimization, scheduling, and notification features.

## System Architecture

### Core Components

- **Garden Optimizer**: Space optimization engine targeting 30% improvement in utilization
- **Maintenance Scheduler**: Automated care schedule generation with environmental factors
- **Notification System**: Real-time push notifications with FCM integration
- **Security Layer**: JWT-based authentication with device fingerprinting
- **Data Layer**: SQLite with optimized query performance

### Performance Targets

- Layout Generation: < 3 seconds
- Schedule Creation: < 2 seconds
- Notification Delivery: Real-time
- Data Sync: < 5 seconds

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0 or yarn >= 1.22.0
- SQLite >= 5.1.0
- Docker >= 20.10.0 (optional)
- SSL certificates for HTTPS
- Firebase Admin SDK credentials

## Development Setup

### Environment Configuration

1. Create `.env` file in the backend root:
```env
PORT=3000
NODE_ENV=development
JWT_SECRET=your_jwt_secret
CORS_WHITELIST=http://localhost:3000,http://localhost:3001
```

2. Install dependencies:
```bash
npm install
```

3. Set up database:
```bash
npm run migrate
npm run seed
```

4. Start development server:
```bash
npm run dev
```

### SSL Configuration

For local HTTPS:
1. Generate self-signed certificates
2. Place in `./ssl` directory
3. Update security config accordingly

## Project Structure

```
src/
├── config/             # Application configuration
├── constants/          # Shared constants and enums
├── controllers/        # Route controllers
├── interfaces/         # TypeScript interfaces
├── middleware/         # Express middleware
├── models/            # Data models
├── repositories/      # Data access layer
├── routes/           # API routes
├── services/         # Business logic
├── utils/            # Utility functions
└── validators/       # Input validation
```

## API Documentation

### Authentication

All endpoints require JWT authentication:
```http
Authorization: Bearer <token>
X-Device-Fingerprint: <device_fingerprint>
```

### Rate Limiting

- Standard endpoints: 100 requests per 15 minutes
- Optimization endpoints: 10 requests per minute
- Notification endpoints: 60 requests per minute

### Error Handling

Standardized error responses:
```json
{
  "error": {
    "code": "E001",
    "message": "Detailed error message",
    "status": 400
  }
}
```

## Testing

### Unit Tests
```bash
npm run test:unit
```

### Integration Tests
```bash
npm run test:integration
```

### E2E Tests
```bash
npm run test:e2e
```

Coverage requirements:
- Statements: 80%
- Branches: 80%
- Functions: 80%
- Lines: 80%

## Deployment

### Production Build
```bash
npm run build
```

### Docker Deployment
```bash
docker build -t garden-planner-backend .
docker run -p 3000:3000 garden-planner-backend
```

### Environment Variables

Required for production:
- `NODE_ENV=production`
- `JWT_SECRET`
- `FIREBASE_ADMIN_SDK`
- `CORS_WHITELIST`
- `SSL_KEY_PATH`
- `SSL_CERT_PATH`

## Maintenance

### Database Optimization
- Weekly cleanup job
- Monthly index optimization
- Daily backup verification

### Security Updates
- Weekly dependency audits
- Monthly security patches
- Quarterly penetration testing

### Performance Monitoring
- Request latency tracking
- Memory usage monitoring
- Error rate alerting
- Cache hit ratio optimization

## Security Guidelines

### Authentication
- JWT with device fingerprinting
- Token rotation every 24 hours
- Maximum 3 concurrent sessions
- Biometric authentication support

### Authorization
- Role-based access control
- Permission-based actions
- Rate limiting per endpoint
- IP-based blocking

### Data Protection
- AES-256 encryption at rest
- TLS 1.3 in transit
- CSRF protection
- XSS prevention

## Support

For technical support:
1. Check error logs in `logs/error.log`
2. Review performance metrics in `logs/metrics.log`
3. Contact development team with:
   - Error code
   - Request ID
   - Environment details
   - Steps to reproduce

## License

ISC License - See LICENSE file for details