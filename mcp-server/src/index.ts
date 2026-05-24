import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerResources } from './resources.js';
import { registerTools } from './tools.js';
import { registerPrompts } from './prompts.js';

async function bootstrap() {
  const server = new Server(
    {
      name: 'bella-spa-erp-mcp-server',
      version: '1.0.0'
    },
    {
      capabilities: {
        resources: {},
        tools: {},
        prompts: {}
      }
    }
  );

  // 1. Register MCP components
  registerResources(server);
  registerTools(server);
  registerPrompts(server);

  // 2. Setup stdio transport connection
  const transport = new StdioServerTransport();
  
  // Connect server
  await server.connect(transport);
  
  // Note: All custom log messages must go to stderr. stdout is reserved for JSON-RPC messages.
  console.error('✅ [Bella Spa ERP] MCP Server started successfully!');
  console.error('👉 Communication channel: stdio (Standard Input/Output)');
  console.error('👉 Supported features: Resources (Database Schema, Tenants), Tools (Financials, Scheduling, Inventory, CSKH), Prompts (Workflows)');
}

bootstrap().catch((error) => {
  console.error('❌ Critical error starting MCP Server:', error);
  process.exit(1);
});
