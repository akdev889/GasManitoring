const WebSocket = require('.ws');
const fs = require('fs');
const path = require('path');
const url = require('url');

// وب سوکت سرور
const wss = new WebSocket.Server({ port: 8080 });

// ذخیره وضعیت گازها
let gasStatus = {
    unit1: { MQ2: false, MQ4: false, MQ9: false },
    unit2: { MQ2: false, MQ4: false, MQ9: false }
};

// کاربران
const users = {
    admin: { password: '123', role: 'admin' },
    unit1: { password: '111', role: 'unit1' },
    unit2: { password: '222', role: 'unit2' }
};

// لیست کلاینت‌های متصل
let clients = [];

wss.on('connection', (ws) => {
    console.log('کلاینت جدید متصل شد');
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            
            // دریافت اطلاعات از NodeMCU
            if (message.unit && message.hasOwnProperty('MQ2')) {
                const unitKey = `unit${message.unit}`;
                gasStatus[unitKey] = {
                    MQ2: message.MQ2,
                    MQ4: message.MQ4,
                    MQ9: message.MQ9
                };
                
                // ارسال به همه کلاینت‌ها
                broadcastToClients();
                console.log(`واحد ${message.unit} داده ارسال کرد:`, gasStatus[unitKey]);
            }
            
            // ورود کاربر
            if (message.type === 'login') {
                const user = users[message.username];
                if (user && user.password === message.password) {
                    ws.role = user.role;
                    clients.push(ws);
                    
                    ws.send(JSON.stringify({
                        type: 'login',
                        success: true,
                        role: user.role,
                        gasStatus: getFilteredStatus(user.role)
                    }));
                    console.log(`${message.username} وارد شد`);
                } else {
                    ws.send(JSON.stringify({
                        type: 'login',
                        success: false,
                        message: 'نام کاربری یا رمز عبور اشتباه است'
                    }));
                }
            }
        } catch (error) {
            console.log('خطا در پردازش پیام:', error);
        }
    });
    
    ws.on('close', () => {
        clients = clients.filter(client => client !== ws);
        console.log('کلاینت قطع شد');
    });
});

// ارسال به همه کلاینت‌ها
function broadcastToClients() {
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'update',
                gasStatus: getFilteredStatus(client.role)
            }));
        }
    });
}

// فیلتر کردن اطلاعات بر اساس نقش کاربر
function getFilteredStatus(role) {
    if (role === 'admin') {
        return gasStatus;
    } else if (role === 'unit1') {
        return { unit1: gasStatus.unit1 };
    } else if (role === 'unit2') {
        return { unit2: gasStatus.unit2 };
    }
    return {};
}

// سرور HTTP برای فایل‌های استاتیک
const http = require('http');
const server = http.createServer((req, res) => {
    const pathname = url.parse(req.url).pathname;
    let filePath = './public' + (pathname === '/' ? '/index.html' : pathname);
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('فایل پیدا نشد');
            return;
        }
        
        const ext = path.extname(filePath);
        let contentType = 'text/html';
        if (ext === '.js') contentType = 'text/javascript';
        if (ext === '.css') contentType = 'text/css';
        
        res.writeHead(200, { 'Content-Type': contentType + '; charset=utf-8' });
        res.end(data);
    });
});

server.listen(3000, () => {
    console.log('سرور HTTP روی پورت 3000 آماده است');
    console.log('وب سوکت روی پورت 8080 آماده است');
    console.log('آدرس: http://localhost:3000');
});
