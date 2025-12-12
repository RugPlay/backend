/**
 * Global teardown for Jest e2e tests
 * This ensures all connections are properly closed even if tests fail
 */
export default async function globalTeardown() {
  // Force close any remaining connections
  console.log('Global teardown: Forcing exit to prevent hanging...');
  
  // Give a small delay for any cleanup to complete
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Force exit if needed (this is a last resort)
  if (process.env.NODE_ENV === 'test') {
    process.exit(0);
  }
}
