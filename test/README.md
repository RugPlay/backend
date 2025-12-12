# Exchange Testing Suite

This directory contains comprehensive tests for the exchange functionality, including market creation, order placement, matching, and market depth analysis.

## Test Files

### 1. `exchange.e2e-spec.ts`
Complete end-to-end tests covering:
- Market creation and management
- Order book operations
- Order placement and matching
- Market depth building
- Trade execution and verification
- Error handling
- Paper trading functionality

### 2. `order-service.e2e-spec.ts`
Focused unit tests for the OrderService:
- Order book management
- Order placement without matching
- Order matching logic
- Partial fills and complete fills
- Price-time priority
- Market data retrieval
- Error handling

### 3. `exchange-integration.e2e-spec.ts`
Integration tests using test helpers:
- Complete trading workflows
- Price-time priority testing
- Market statistics and analytics
- Performance testing
- Concurrent order handling

### 4. `helpers/test-data.helper.ts`
Utility class for creating test data:
- Test market creation
- Test portfolio creation (real and paper)
- Test order generation
- Market depth building
- Order book validation
- Performance test data

## Running the Tests

### Prerequisites
1. Ensure the database is set up and running
2. Redis should be running for order book operations
3. All dependencies should be installed (`npm install`)

### Run All Exchange Tests
```bash
# Run all e2e tests (includes all exchange tests)
npm run test:e2e

# Run tests in watch mode for development
npm run test:e2e -- --watch

# Run tests with coverage
npm run test:e2e -- --coverage
```

### Run Individual Test Suites
```bash
# Run main exchange tests
npm run test:e2e -- exchange.e2e-spec.ts

# Run order service tests  
npm run test:e2e -- order-service.e2e-spec.ts

# Run integration tests
npm run test:e2e -- exchange-integration.e2e-spec.ts
```

### Run Specific Test Cases
```bash
# Run only market creation tests
npm run test:e2e -- --testNamePattern="Market Creation"

# Run only order matching tests
npm run test:e2e -- --testNamePattern="Order Matching"

# Run only paper trading tests
npm run test:e2e -- --testNamePattern="Paper Trading"

# Run tests with verbose output
npm run test:e2e -- --verbose
```

## Test Scenarios Covered

### Market Operations
- ✅ Create new markets with various configurations
- ✅ Retrieve market information
- ✅ List all available markets
- ✅ Market validation and error handling

### Order Book Management
- ✅ Empty order book initialization
- ✅ Order placement without matching
- ✅ Market depth building with multiple orders
- ✅ Order book sorting (bids descending, asks ascending)
- ✅ Order book validation

### Order Matching
- ✅ Exact price and quantity matches
- ✅ Partial order fills
- ✅ Multiple order matches
- ✅ Price-time priority enforcement
- ✅ Cross-spread matching
- ✅ Order completion and updates

### Trade Execution
- ✅ Trade creation and recording
- ✅ Portfolio balance adjustments
- ✅ Holdings transfers
- ✅ Trade type classification (real vs paper)
- ✅ Event publishing

### Paper Trading
- ✅ Paper portfolio detection
- ✅ Paper order processing
- ✅ Paper trade creation
- ✅ Isolation from real markets

### Performance & Reliability
- ✅ High-frequency order placement
- ✅ Concurrent order handling
- ✅ Error recovery
- ✅ Data consistency
- ✅ Memory and performance optimization

### Error Handling
- ✅ Invalid order parameters
- ✅ Non-existent markets
- ✅ Portfolio validation
- ✅ Insufficient balance scenarios
- ✅ Network and database errors

## Test Data Management

The tests use a combination of:
- **Mock Data**: Generated UUIDs for portfolios and orders
- **Real Database**: Actual market and trade records
- **Helper Functions**: Standardized test data creation
- **Cleanup**: Automatic test data cleanup after test completion

## Expected Test Results

When all tests pass, you should see:
- Markets created and retrieved successfully
- Order books built with proper depth
- Orders matched according to price-time priority
- Trades executed and recorded correctly
- Portfolio balances adjusted appropriately
- Paper trades isolated from real trading
- All error conditions handled gracefully

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Ensure PostgreSQL is running
   - Check database configuration in `.env`
   - Verify database migrations are applied

2. **Redis Connection Errors**
   - Ensure Redis is running on the configured port
   - Check Redis configuration in environment variables

3. **Portfolio Not Found Errors**
   - Tests use mock portfolio IDs
   - In production, portfolios must be created first
   - Consider creating test portfolios in setup

4. **Test Timeouts**
   - Increase Jest timeout for slow operations
   - Check database performance
   - Verify Redis connectivity

### Debug Mode
```bash
# Run tests with verbose output
npm run test:e2e -- --verbose

# Run tests with debug logging
DEBUG=* npm run test:e2e

# Run single test for debugging
npm run test:e2e -- --testNamePattern="specific test name"

# Run tests and keep Jest open for debugging
npm run test:e2e -- --detectOpenHandles

# Run with maximum worker processes for faster execution
npm run test:e2e -- --maxWorkers=4
```

## Contributing

When adding new tests:
1. Use the `TestDataHelper` for consistent test data
2. Follow the existing test structure and naming
3. Include both success and error scenarios
4. Add cleanup for any created test data
5. Document any new test scenarios in this README

## Architecture Notes

The tests are designed to:
- Test the complete exchange workflow end-to-end
- Validate business logic and data consistency
- Ensure proper error handling and recovery
- Verify performance under load
- Maintain separation between paper and real trading
- Provide comprehensive coverage of all exchange features
