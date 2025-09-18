# Zantara Bridge - Architecture Improvements

## Current Pain Points

### 1. API Flow Control Issues
- **Problem**: Difficult to track and control API flows
- **Root Cause**: Multiple auth patterns, distributed error handling, no centralized flow control

### 2. Authentication Complexity
- Service Account + DWD + API Keys + Bearer tokens
- Different auth for different endpoints
- Legacy code mixed with new implementations

## Proposed Solutions

### 1. Centralized API Gateway Pattern
```typescript
// src/core/apiGateway.ts
class ApiGateway {
  private requestQueue = new Map<string, Promise<any>>();
  private rateLimiter = new RateLimiter();
  
  async execute<T>(
    operation: string,
    fn: () => Promise<T>,
    options: { retry?: number; cache?: boolean }
  ): Promise<T> {
    // 1. Check rate limits
    await this.rateLimiter.check(operation);
    
    // 2. Check cache if enabled
    if (options.cache) {
      const cached = await this.cache.get(operation);
      if (cached) return cached;
    }
    
    // 3. Dedup concurrent identical requests
    if (this.requestQueue.has(operation)) {
      return this.requestQueue.get(operation);
    }
    
    // 4. Execute with retry logic
    const promise = this.executeWithRetry(fn, options.retry || 3);
    this.requestQueue.set(operation, promise);
    
    try {
      const result = await promise;
      if (options.cache) {
        await this.cache.set(operation, result);
      }
      return result;
    } finally {
      this.requestQueue.delete(operation);
    }
  }
}
```

### 2. Unified Error Handler
```typescript
// src/middleware/errorHandler.ts
export class ApiError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
  }
}

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  // Standardized error response
  const error = normalizeError(err);
  
  // Log with context
  logger.error({
    error: error.code,
    message: error.message,
    path: req.path,
    user: req.headers['x-bz-user'],
    traceId: req.id
  });
  
  // Metrics
  metrics.increment('api.errors', { code: error.code });
  
  res.status(error.statusCode).json({
    ok: false,
    error: error.code,
    message: error.message,
    traceId: req.id
  });
};
```

### 3. Request Pipeline
```typescript
// src/core/pipeline.ts
export class RequestPipeline {
  private middlewares: Middleware[] = [];
  
  use(middleware: Middleware) {
    this.middlewares.push(middleware);
    return this;
  }
  
  async process(req: PipelineRequest): Promise<PipelineResponse> {
    const context = {
      req,
      user: null,
      auth: null,
      drive: null,
      traceId: generateTraceId()
    };
    
    // Run through pipeline
    for (const middleware of this.middlewares) {
      await middleware(context);
      if (context.response) break;
    }
    
    return context.response;
  }
}

// Usage
const pipeline = new RequestPipeline()
  .use(authMiddleware)
  .use(rateLimitMiddleware)
  .use(impersonationMiddleware)
  .use(cacheMiddleware)
  .use(executionMiddleware);
```

### 4. Observability Layer
```typescript
// src/core/telemetry.ts
import { trace, metrics } from '@opentelemetry/api';

export class Telemetry {
  private tracer = trace.getTracer('zantara-bridge');
  
  async traceOperation<T>(
    name: string,
    attributes: Record<string, any>,
    fn: () => Promise<T>
  ): Promise<T> {
    const span = this.tracer.startSpan(name, { attributes });
    
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }
}
```

### 5. Circuit Breaker Pattern
```typescript
// src/core/circuitBreaker.ts
export class CircuitBreaker {
  private failures = 0;
  private lastFailTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailTime = Date.now();
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
}
```

## Implementation Priority

1. **Phase 1**: Centralized Error Handling (1 week)
   - Implement unified error handler
   - Standardize error responses
   - Add request tracing

2. **Phase 2**: API Gateway Pattern (2 weeks)
   - Implement gateway class
   - Add rate limiting
   - Add request deduplication

3. **Phase 3**: Observability (1 week)
   - Add OpenTelemetry
   - Implement distributed tracing
   - Create metrics dashboard

4. **Phase 4**: Circuit Breaker (1 week)
   - Implement circuit breaker
   - Add health checks
   - Auto-recovery logic

## Benefits

- **Visibility**: Full tracing of every API call
- **Control**: Centralized flow control and rate limiting
- **Reliability**: Automatic retry and circuit breaking
- **Performance**: Request deduplication and caching
- **Debugging**: Consistent error handling and logging

## Monitoring Dashboard

```yaml
# docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
  
  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
    environment:
      - GF_AUTH_ANONYMOUS_ENABLED=true
  
  jaeger:
    image: jaegertracing/all-in-one
    ports:
      - "16686:16686"
      - "14268:14268"
```

## Metrics to Track

- API call volume by endpoint
- Error rates by error code
- P95/P99 latencies
- Rate limit hits
- Circuit breaker trips
- Cache hit rates
- DWD impersonation success rate
- Google API quota usage

This architecture would give Zantara complete control and visibility over all API flows.