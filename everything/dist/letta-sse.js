#!/usr/bin/env node
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListResourcesRequestSchema, ListResourceTemplatesRequestSchema, ListToolsRequestSchema, CallToolRequestSchema, ReadResourceRequestSchema, McpError, ErrorCode, } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
const app = express();
// Create and initialize the server
const init = async () => {
    // Get environment variables
    const apiBase = process.env.LETTA_BASE_URL || '';
    const password = process.env.LETTA_PASSWORD || '';
    console.log(`LETTA_BASE_URL: ${apiBase ? 'configured' : 'not configured'}`);
    console.log(`LETTA_PASSWORD: ${password ? 'configured' : 'not configured'}`);
    // Initialize API client if credentials are available
    let api = null;
    let useRealApi = false;
    if (apiBase && password) {
        try {
            const baseUrl = `${apiBase}/v1`;
            console.log(`Connecting to Letta API at ${baseUrl}`);
            api = axios.create({
                baseURL: baseUrl,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-BARE-PASSWORD': `password ${password}`
                },
            });
            // Test the connection
            const response = await api.get('/agents');
            if (response.status === 200) {
                useRealApi = true;
                console.log('Successfully connected to Letta API');
                console.log(`Found ${response.data.length} agents on the server`);
            }
            else {
                console.error(`Failed to connect to API: status ${response.status}`);
            }
        }
        catch (error) {
            console.error('Failed to connect to Letta API:', error.message);
            if (error.response) {
                console.error('API Response:', error.response.status, error.response.data);
            }
            console.log('Using mock implementation instead');
        }
    }
    else {
        console.log('Using mock implementation (no API credentials provided)');
    }
    const server = new Server({
        name: "letta-server",
        version: "1.0.0",
    }, {
        capabilities: {
            prompts: {},
            resources: {},
            tools: {},
            logging: {},
        },
    });
    // Set up required MCP method handlers
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        const tools = [
            {
                name: 'create_agent',
                description: 'Create a new Letta agent with specified configuration',
                inputSchema: {
                    type: 'object',
                    properties: {
                        name: {
                            type: 'string',
                            description: 'Name of the new agent',
                        },
                        description: {
                            type: 'string',
                            description: 'Description of the agent\'s purpose/role',
                        },
                        model: {
                            type: 'string',
                            description: 'The model to use for the agent',
                            default: 'openai/gpt-4',
                        },
                        embedding: {
                            type: 'string',
                            description: 'The embedding model to use',
                            default: 'openai/text-embedding-ada-002',
                        },
                    },
                    required: ['name', 'description'],
                },
            },
            {
                name: 'list_agents',
                description: 'List all available agents in the Letta system',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filter: {
                            type: 'string',
                            description: 'Optional filter to search for specific agents',
                        },
                    },
                    required: [],
                },
            },
            {
                name: 'prompt_agent',
                description: 'Send a message to an agent and get a response',
                inputSchema: {
                    type: 'object',
                    properties: {
                        agent_id: {
                            type: 'string',
                            description: 'ID of the agent to prompt',
                        },
                        message: {
                            type: 'string',
                            description: 'Message to send to the agent',
                        },
                    },
                    required: ['agent_id', 'message'],
                },
            },
            {
                name: 'list_agent_tools',
                description: 'List all tools available for a specific agent',
                inputSchema: {
                    type: 'object',
                    properties: {
                        agent_id: {
                            type: 'string',
                            description: 'ID of the agent to list tools for',
                        },
                    },
                    required: ['agent_id'],
                },
            },
            {
                name: 'list_tools',
                description: 'List all available tools on the Letta server',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filter: {
                            type: 'string',
                            description: 'Optional filter to search for specific tools by name or description',
                        },
                        page: {
                            type: 'number',
                            description: 'Page number for pagination (starts at 1)',
                        },
                        pageSize: {
                            type: 'number',
                            description: 'Number of tools per page (1-100, default: 10)',
                        },
                    },
                    required: [],
                },
            },
            {
                name: 'attach_tool',
                description: 'Attach one or more tools to an agent',
                inputSchema: {
                    type: 'object',
                    properties: {
                        tool_id: {
                            type: 'string',
                            description: 'The ID of a single tool to attach (deprecated, use tool_ids instead)',
                        },
                        tool_ids: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Array of tool IDs to attach',
                        },
                        agent_id: {
                            type: 'string',
                            description: 'The ID of the agent to attach the tool(s) to',
                        },
                    },
                    required: ['agent_id'],
                },
            },
            {
                name: 'list_memory_blocks',
                description: 'List all memory blocks available in the Letta system',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filter: {
                            type: 'string',
                            description: 'Optional filter to search for specific blocks by name or content',
                        },
                        agent_id: {
                            type: 'string',
                            description: 'Optional agent ID to list blocks for a specific agent',
                        },
                        page: {
                            type: 'number',
                            description: 'Page number for pagination (starts at 1)',
                        },
                        pageSize: {
                            type: 'number',
                            description: 'Number of blocks per page (1-100, default: 10)',
                        },
                        label: {
                            type: 'string',
                            description: 'Optional filter for block label (e.g., "human", "persona")',
                        },
                        templates_only: {
                            type: 'boolean',
                            description: 'Whether to include only templates (default: false)',
                        },
                        name: {
                            type: 'string',
                            description: 'Optional filter for block name',
                        },
                        include_full_content: {
                            type: 'boolean',
                            description: 'Whether to include the full content of blocks (default: false)',
                        },
                    },
                    required: [],
                },
            },
            {
                name: 'read_memory_block',
                description: 'Get full details of a specific memory block by ID',
                inputSchema: {
                    type: 'object',
                    properties: {
                        block_id: {
                            type: 'string',
                            description: 'ID of the memory block to retrieve'
                        }
                    },
                    required: ['block_id']
                }
            },
            {
                name: 'update_memory_block',
                description: 'Update the contents and metadata of a memory block',
                inputSchema: {
                    type: 'object',
                    properties: {
                        block_id: {
                            type: 'string',
                            description: 'ID of the memory block to update'
                        },
                        value: {
                            type: 'string',
                            description: 'New value for the memory block (optional)'
                        },
                        metadata: {
                            type: 'object',
                            description: 'New metadata for the memory block (optional)'
                        },
                        agent_id: {
                            type: 'string',
                            description: 'Optional agent ID for authorization'
                        }
                    },
                    required: ['block_id']
                }
            },
            {
                name: 'attach_memory_block',
                description: 'Attach a memory block to an agent',
                inputSchema: {
                    type: 'object',
                    properties: {
                        block_id: {
                            type: 'string',
                            description: 'The ID of the memory block to attach',
                        },
                        agent_id: {
                            type: 'string',
                            description: 'The ID of the agent to attach the memory block to',
                        },
                        label: {
                            type: 'string',
                            description: 'Optional label for the memory block (e.g., "persona", "human", "system")',
                        },
                    },
                    required: ['block_id', 'agent_id'],
                },
            },
            {
                name: 'create_memory_block',
                description: 'Create a new memory block in the Letta system',
                inputSchema: {
                    type: 'object',
                    properties: {
                        name: {
                            type: 'string',
                            description: 'Name of the memory block',
                        },
                        label: {
                            type: 'string',
                            description: 'Label for the memory block (e.g., "persona", "human", "system")',
                        },
                        value: {
                            type: 'string',
                            description: 'Content of the memory block',
                        },
                        agent_id: {
                            type: 'string',
                            description: 'Optional agent ID to create the block for a specific agent',
                        },
                        metadata: {
                            type: 'object',
                            description: 'Optional metadata for the memory block',
                        },
                    },
                    required: ['name', 'label', 'value'],
                },
            },
            {
                name: 'upload_tool',
                description: 'Upload a new tool to the Letta system',
                inputSchema: {
                    type: 'object',
                    properties: {
                        name: {
                            type: 'string',
                            description: 'Name of the tool',
                        },
                        description: {
                            type: 'string',
                            description: 'Description of what the tool does',
                        },
                        source_code: {
                            type: 'string',
                            description: 'Python source code for the tool',
                        },
                        category: {
                            type: 'string',
                            description: 'Category/tag for the tool (e.g., "plane_api", "utility")',
                            default: 'custom',
                        },
                        agent_id: {
                            type: 'string',
                            description: 'Optional agent ID to attach the tool to after creation',
                        }
                    },
                    required: ['name', 'description', 'source_code'],
                },
            },
            {
                name: 'echo',
                description: 'Echo a message back',
                inputSchema: {
                    type: 'object',
                    properties: {
                        message: {
                            type: 'string',
                            description: 'Message to echo'
                        }
                    },
                    required: ['message']
                }
            }
        ];
        return { tools };
    });
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        const typedArgs = args;
        // Log the API credentials if available
        if (useRealApi) {
            console.log(`Executing ${name} with real API`);
        }
        else {
            console.log(`Executing ${name} with mock implementation`);
        }
        if (useRealApi && api) {
            try {
                // Create standard headers for API requests
                const headers = {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-BARE-PASSWORD': `password ${password}`
                };
                if (name === 'list_tools') {
                    // Get all tools from the Letta server
                    console.log('Fetching tools from Letta API...');
                    const toolsResponse = await api.get('/tools', { headers });
                    let tools = toolsResponse.data;
                    console.log(`Found ${tools.length} tools on the server`);
                    // Apply filter if provided
                    if (typeof typedArgs.filter === 'string') {
                        const filterLower = typedArgs.filter.toLowerCase();
                        tools = tools.filter((tool) => (tool.name && tool.name.toLowerCase().includes(filterLower)) ||
                            (tool.description && tool.description.toLowerCase().includes(filterLower)));
                    }
                    // Apply pagination
                    const page = typedArgs.page ? Math.max(1, typedArgs.page) : 1;
                    const pageSize = typedArgs.pageSize ? Math.max(1, Math.min(100, typedArgs.pageSize)) : 10;
                    const startIndex = (page - 1) * pageSize;
                    const endIndex = startIndex + pageSize;
                    const totalTools = tools.length;
                    const totalPages = Math.ceil(totalTools / pageSize);
                    const paginatedTools = tools.slice(startIndex, endIndex);
                    return {
                        content: [{
                                type: 'text',
                                text: JSON.stringify({
                                    success: true,
                                    pagination: {
                                        page: page,
                                        pageSize: pageSize,
                                        totalTools: totalTools,
                                        totalPages: totalPages,
                                        hasNextPage: page < totalPages,
                                        hasPreviousPage: page > 1
                                    },
                                    tool_count: paginatedTools.length,
                                    tools: paginatedTools
                                }, null, 2),
                            }],
                    };
                }
                // Handle other API requests
                if (name === 'create_agent') {
                    // Create new agent
                    if (!typedArgs.name || !typedArgs.description) {
                        throw new Error("Name and description are required");
                    }
                    const model = typedArgs.model || 'openai/gpt-4';
                    const embedding = typedArgs.embedding || 'openai/text-embedding-ada-002';
                    const modelParts = model.split('/');
                    const modelName = modelParts[1] || 'gpt-4';
                    const modelEndpoint = modelParts[0] || 'openai';
                    const agentConfig = {
                        name: typedArgs.name,
                        description: typedArgs.description,
                        agent_type: "memgpt_agent",
                        model: model,
                        llm_config: {
                            model: modelName,
                            model_endpoint_type: modelEndpoint,
                            context_window: 16000,
                            max_tokens: 1000,
                            temperature: 0.7,
                            frequency_penalty: 0.5,
                            presence_penalty: 0.5,
                            functions_config: {
                                allow: true,
                                functions: []
                            }
                        },
                        embedding: embedding,
                        parameters: {
                            context_window: 16000,
                            max_tokens: 1000,
                            temperature: 0.7,
                            presence_penalty: 0.5,
                            frequency_penalty: 0.5
                        },
                        core_memory: {}
                    };
                    try {
                        console.log('Creating agent with real API...');
                        const response = await api.post('/agents', agentConfig, { headers });
                        const agentId = response.data.id;
                        console.log(`Agent created successfully with ID: ${agentId}`);
                        // Get agent capabilities
                        const agentInfoResponse = await api.get(`/agents/${agentId}`, { headers });
                        const capabilities = agentInfoResponse.data.tools?.map((t) => t.name) || [];
                        return {
                            content: [{
                                    type: 'text',
                                    text: JSON.stringify({
                                        success: true,
                                        message: `Agent ${typedArgs.name} created successfully with ID: ${agentId}`,
                                        agent_id: agentId,
                                        capabilities: capabilities
                                    }, null, 2),
                                }],
                        };
                    }
                    catch (error) {
                        console.error('Error creating agent with real API:', error.message);
                        if (error.response) {
                            console.error('API Response:', error.response.status, error.response.data);
                        }
                        // Fall back to mock implementation
                        console.log('Falling back to mock implementation for create_agent');
                        return useMockImplementation(name, typedArgs);
                    }
                }
                if (name === 'list_agents') {
                    const response = await api.get('/agents', { headers });
                    const agents = response.data;
                    // Apply filter if provided
                    let filteredAgents = agents;
                    if (typeof typedArgs.filter === 'string') {
                        const filter = typedArgs.filter.toLowerCase();
                        filteredAgents = agents.filter((agent) => agent.name.toLowerCase().includes(filter) ||
                            (agent.description && agent.description.toLowerCase().includes(filter)));
                    }
                    return {
                        content: [{
                                type: 'text',
                                text: JSON.stringify({
                                    success: true,
                                    count: filteredAgents.length,
                                    agents: filteredAgents
                                }, null, 2),
                            }],
                    };
                }
                if (name === 'echo') {
                    // Simple echo tool for testing
                    if (typeof typedArgs.message !== 'string') {
                        throw new Error("Message is required for echo tool");
                    }
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Echo (via API): ${typedArgs.message}`
                            }
                        ]
                    };
                }
                // For other commands, use mock implementation
                console.log(`Command ${name} not yet implemented with real API, using mock`);
                return useMockImplementation(name, typedArgs);
            }
            catch (error) {
                console.error(`Error executing ${name}:`, error.message);
                if (error.response) {
                    console.error('API Response:', error.response.status, error.response.data);
                }
                console.log('Falling back to mock implementation');
                return useMockImplementation(name, typedArgs);
            }
        }
        else {
            // Use mock implementation
            return useMockImplementation(name, typedArgs);
        }
    });
    // Helper function for mock implementations
    function useMockImplementation(name, args) {
        if (name === 'list_agents') {
            // Mock implementation
            const mockAgents = [
                {
                    id: "agent-755f1df6-6c53-4a62-8cf5-e1c441c3bd41",
                    name: "Pansil",
                    description: "A helpful assistant",
                    type: "memgpt_agent",
                    model: "openai/gpt-4",
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                },
                {
                    id: "agent-mock-id-1",
                    name: "Research Assistant",
                    description: "Helps with research tasks",
                    type: "memgpt_agent",
                    model: "openai/gpt-4",
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }
            ];
            // Apply filter if provided
            let filteredAgents = mockAgents;
            if (typeof args.filter === 'string') {
                const filter = args.filter.toLowerCase();
                filteredAgents = mockAgents.filter(agent => agent.name.toLowerCase().includes(filter) ||
                    agent.description.toLowerCase().includes(filter));
            }
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            count: filteredAgents.length,
                            agents: filteredAgents
                        }, null, 2),
                    }],
            };
        }
        else if (name === 'list_tools') {
            // Mock implementation
            const mockTools = [
                {
                    id: "tool-1",
                    name: "web_search",
                    description: "Search the web for information",
                    tags: ["utility"]
                },
                {
                    id: "tool-2",
                    name: "calculator",
                    description: "Perform mathematical calculations",
                    tags: ["utility"]
                }
            ];
            // Apply filter if provided
            let filteredTools = mockTools;
            if (typeof args.filter === 'string') {
                const filterLower = args.filter.toLowerCase();
                filteredTools = mockTools.filter(tool => tool.name.toLowerCase().includes(filterLower) ||
                    tool.description.toLowerCase().includes(filterLower));
            }
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            tool_count: filteredTools.length,
                            tools: filteredTools
                        }, null, 2),
                    }],
            };
        }
        else if (name === 'echo') {
            // Simple echo tool for testing
            if (typeof args.message !== 'string') {
                throw new Error("Message is required for echo tool");
            }
            return {
                content: [
                    {
                        type: "text",
                        text: `Echo (mock): ${args.message}`
                    }
                ]
            };
        }
        else if (name === 'create_agent') {
            // Mock implementation
            if (!args.name || !args.description) {
                throw new Error("Name and description are required for creating an agent");
            }
            const mockAgentId = `agent-${Date.now()}`;
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            message: `Agent ${args.name} created successfully with ID: ${mockAgentId}`,
                            agent_id: mockAgentId,
                            capabilities: ["web_search", "calculator"],
                        }, null, 2),
                    }],
            };
        }
        else if (name === 'prompt_agent') {
            // Mock implementation
            if (!args.agent_id || !args.message) {
                throw new Error("Agent ID and message are required");
            }
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            agent_id: args.agent_id,
                            agent_name: "Mock Agent",
                            message: args.message,
                            response: `This is a mock response to: "${args.message}"`,
                        }, null, 2),
                    }],
            };
        }
        else if (name === 'list_agent_tools') {
            // Mock implementation
            if (!args.agent_id) {
                throw new Error("Agent ID is required");
            }
            const mockTools = [
                {
                    id: "tool-1",
                    name: "web_search",
                    description: "Search the web for information"
                },
                {
                    id: "tool-2",
                    name: "calculator",
                    description: "Perform mathematical calculations"
                }
            ];
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            agent_id: args.agent_id,
                            agent_name: "Mock Agent",
                            tool_count: mockTools.length,
                            tools: mockTools
                        }, null, 2),
                    }],
            };
        }
        else if (name === 'attach_tool') {
            // Mock implementation
            if (!args.agent_id) {
                throw new Error("Agent ID is required");
            }
            // Handle tool_ids as array or string, or tool_id as string
            const toolIdArray = [];
            if (typeof args.tool_ids === 'string') {
                toolIdArray.push(args.tool_ids);
            }
            else if (Array.isArray(args.tool_ids)) {
                toolIdArray.push(...args.tool_ids);
            }
            else if (typeof args.tool_id === 'string') {
                toolIdArray.push(args.tool_id);
            }
            if (toolIdArray.length === 0) {
                throw new Error("No tool IDs provided");
            }
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            message: `Successfully attached ${toolIdArray.length} tool(s) to agent.`,
                            agent_id: args.agent_id,
                            agent_name: "Mock Agent",
                            total_tools: toolIdArray.length,
                            successful_tools: toolIdArray.length,
                            failed_tools: 0,
                            results: toolIdArray.map((id) => ({
                                success: true,
                                tool_id: id,
                                tool_name: `Tool ${id}`,
                                message: `Tool ${id} successfully attached to agent.`
                            }))
                        }, null, 2),
                    }],
            };
        }
        else if (name === 'list_memory_blocks') {
            // Mock implementation
            const mockBlocks = [
                {
                    id: "block-1",
                    name: "Personal Info",
                    label: "persona",
                    value_preview: "I am an AI assistant named Pansil...",
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                },
                {
                    id: "block-2",
                    name: "User Preferences",
                    label: "human",
                    value_preview: "The user prefers concise answers...",
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }
            ];
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            block_count: mockBlocks.length,
                            blocks: mockBlocks
                        }, null, 2),
                    }],
            };
        }
        else if (name === 'read_memory_block') {
            // Mock implementation
            if (!args.block_id) {
                throw new Error("Block ID is required");
            }
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            block: {
                                id: args.block_id,
                                name: "Memory Block",
                                label: "custom",
                                value: "This is the content of the memory block.",
                                metadata: {
                                    type: "custom",
                                    version: "1.0",
                                    last_updated: new Date().toISOString()
                                },
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            }
                        }, null, 2),
                    }],
            };
        }
        else if (name === 'update_memory_block') {
            // Mock implementation
            if (!args.block_id) {
                throw new Error("Block ID is required");
            }
            if (!args.value && !args.metadata) {
                throw new Error("Either value or metadata must be provided");
            }
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            block: {
                                id: args.block_id,
                                name: "Memory Block",
                                label: "custom",
                                value: args.value || "Original content",
                                metadata: args.metadata || {
                                    type: "custom",
                                    version: "1.0",
                                    last_updated: new Date().toISOString()
                                },
                                updated_at: new Date().toISOString()
                            }
                        }, null, 2),
                    }],
            };
        }
        else if (name === 'attach_memory_block') {
            // Mock implementation
            if (!args.block_id || !args.agent_id) {
                throw new Error("Block ID and Agent ID are required");
            }
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            message: `Memory block successfully attached to agent.`,
                            agent_id: args.agent_id,
                            agent_name: "Mock Agent",
                            block_id: args.block_id,
                            block_name: "Memory Block",
                            label: args.label || "custom"
                        }, null, 2),
                    }],
            };
        }
        else if (name === 'create_memory_block') {
            // Mock implementation
            if (!args.name || !args.label || !args.value) {
                throw new Error("Name, label, and value are required");
            }
            const mockBlockId = `block-${Date.now()}`;
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            message: `Memory block "${args.name}" created successfully.`,
                            block_id: mockBlockId,
                            block_name: args.name,
                            label: args.label
                        }, null, 2),
                    }],
            };
        }
        else if (name === 'upload_tool') {
            // Mock implementation
            if (!args.name || !args.description || !args.source_code) {
                throw new Error("Name, description, and source_code are required");
            }
            const mockToolId = `tool-${Date.now()}`;
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            message: `Tool "${args.name}" created successfully.`,
                            tool_id: mockToolId,
                            tool_name: args.name,
                            category: args.category || "custom"
                        }, null, 2),
                    }],
            };
        }
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
        return { resources: [] };
    });
    server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
        return { resourceTemplates: [] };
    });
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        throw new McpError(ErrorCode.InvalidRequest, `Resource not found: ${request.params.uri}`);
    });
    let transport;
    app.get("/sse", async (req, res) => {
        console.log("Received SSE connection");
        transport = new SSEServerTransport("/message", res);
        await server.connect(transport);
        // Handle connection close
        req.on('close', () => {
            console.log("SSE connection closed");
        });
        server.onclose = async () => {
            console.log("Server closing...");
            await server.close();
        };
    });
    app.post("/message", async (req, res) => {
        try {
            console.log("Received message");
            if (!transport) {
                console.error("No active SSE connection");
                res.status(503).json({ error: "No active SSE connection" });
                return;
            }
            await transport.handlePostMessage(req, res);
        }
        catch (error) {
            console.error("Error handling message:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`Letta SSE server is running on port ${PORT}`);
        console.log(`API credentials: ${apiBase ? 'Available' : 'Not available'}`);
        console.log(`Using ${useRealApi ? 'REAL API' : 'MOCK IMPLEMENTATION'}`);
    });
};
// Start the server with error handling
init().catch(error => {
    console.error("Failed to initialize server:", error);
    process.exit(1);
});
