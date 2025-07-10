const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const url = require('url');

class StaticServer {
    constructor() {
        this.mimeTypes = {
            '.html': 'text/html; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.wav': 'audio/wav',
            '.mp3': 'audio/mpeg',
            '.mp4': 'video/mp4',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.ttf': 'font/ttf',
            '.eot': 'application/vnd.ms-fontobject',
            '.otf': 'font/otf',
            '.wasm': 'application/wasm'
        };
        
        this.allowedDirectories = ['.', './dataJson', './assets'];
        this.securityHeaders = {
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Referrer-Policy': 'strict-origin-when-cross-origin'
        };
    }

    // Security: Validate file path to prevent directory traversal
    validatePath(filePath) {
        const resolvedPath = path.resolve(filePath);
        const allowedPaths = this.allowedDirectories.map(dir => path.resolve(dir));
        
        return allowedPaths.some(allowedPath => 
            resolvedPath.startsWith(allowedPath)
        );
    }

    // Get content type with fallback
    getContentType(filePath) {
        const extname = String(path.extname(filePath)).toLowerCase();
        return this.mimeTypes[extname] || 'application/octet-stream';
    }

    // Add security headers
    addSecurityHeaders(res) {
        Object.entries(this.securityHeaders).forEach(([header, value]) => {
            res.setHeader(header, value);
        });
    }

    // Enhanced error handling
    handleError(res, error, filePath) {
        console.error(`Error serving ${filePath}:`, error.message);
        
        switch (error.code) {
            case 'ENOENT':
                res.writeHead(404, { 
                    'Content-Type': 'text/html; charset=utf-8',
                    ...this.securityHeaders
                });
                res.end(`
                    <!DOCTYPE html>
                    <html>
                    <head><title>404 - Not Found</title></head>
                    <body>
                        <h1>404 - File Not Found</h1>
                        <p>The requested file could not be found.</p>
                        <a href="/">Go back to home</a>
                    </body>
                    </html>
                `, 'utf-8');
                break;
                
            case 'EACCES':
                res.writeHead(403, { 
                    'Content-Type': 'text/plain; charset=utf-8',
                    ...this.securityHeaders
                });
                res.end('403 - Access Denied', 'utf-8');
                break;
                
            case 'EISDIR':
                res.writeHead(400, { 
                    'Content-Type': 'text/plain; charset=utf-8',
                    ...this.securityHeaders
                });
                res.end('400 - Cannot serve directory', 'utf-8');
                break;
                
            default:
                res.writeHead(500, { 
                    'Content-Type': 'text/plain; charset=utf-8',
                    ...this.securityHeaders
                });
                res.end('500 - Internal Server Error', 'utf-8');
        }
    }

    // Main request handler
    async handleRequest(req, res) {
        try {
            const timestamp = new Date().toISOString();
            const clientIP = req.connection.remoteAddress || req.socket.remoteAddress;
            console.log(`[${timestamp}] ${req.method} ${req.url} from ${clientIP}`);

            // Only handle GET requests
            if (req.method !== 'GET') {
                res.writeHead(405, { 
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Allow': 'GET',
                    ...this.securityHeaders
                });
                res.end('405 - Method Not Allowed', 'utf-8');
                return;
            }

            // Parse URL and validate
            const parsedUrl = url.parse(req.url);
            let filePath = '.' + parsedUrl.pathname;
            
            // Default to index.html for root
            if (filePath === './') {
                filePath = './index.html';
            }

            // Security: Validate file path
            if (!this.validatePath(filePath)) {
                res.writeHead(403, { 
                    'Content-Type': 'text/plain; charset=utf-8',
                    ...this.securityHeaders
                });
                res.end('403 - Access Denied', 'utf-8');
                return;
            }

            // Get file stats first
            const stats = await fs.stat(filePath);
            
            // Don't serve directories
            if (stats.isDirectory()) {
                throw { code: 'EISDIR' };
            }

            // Read file content
            const content = await fs.readFile(filePath);
            const contentType = this.getContentType(filePath);

            // Set headers
            this.addSecurityHeaders(res);
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Length', content.length);
            res.setHeader('Last-Modified', stats.mtime.toUTCString());
            
            // Add cache headers for static assets
            if (filePath.includes('/dataJson/') || 
                ['.js', '.css', '.png', '.jpg', '.woff', '.woff2'].includes(path.extname(filePath))) {
                res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
            } else {
                res.setHeader('Cache-Control', 'no-cache');
            }

            res.writeHead(200);
            res.end(content);

        } catch (error) {
            this.handleError(res, error, req.url);
        }
    }
}

// Initialize server
const staticServer = new StaticServer();
const server = http.createServer((req, res) => {
    staticServer.handleRequest(req, res);
});

// Enhanced server startup
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

server.listen(PORT, HOST, () => {
    console.log(`🚀 DeutschLern Development Server`);
    console.log(`📍 Running at: http://${HOST}:${PORT}/`);
    console.log(`🔒 Security headers enabled`);
    console.log(`📂 Serving files from: ${path.resolve('.')}`);
    console.log(`⏰ Started at: ${new Date().toISOString()}`);
    console.log(`\n🌐 Open your browser and navigate to: http://${HOST}:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});