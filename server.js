const PORT = process.env.PORT || 3000;
const io = require('socket.io')(PORT, { 
    cors: { 
        origin: "*", 
        methods: ["GET", "POST"] 
    } 
});

let players = {};
let foods = [];
let blackHoles = [];
const MAP_SIZE = 5000;

// Gerar comida
function spawnFood(n) { 
    for(let i=0; i<n; i++) {
        foods.push({
            id: Math.random(), 
            x: Math.random() * MAP_SIZE, 
            y: Math.random() * MAP_SIZE, 
            color: `hsl(${Math.random() * 360}, 80%, 60%)`
        });
    } 
}

// Gerar Buracos Negros
function spawnBH(n) { 
    for(let i=0; i<n; i++) {
        blackHoles.push({
            id: Math.random(), 
            x: Math.random() * MAP_SIZE, 
            y: Math.random() * MAP_SIZE
        });
    } 
}

// Inicialização
spawnFood(400); 
spawnBH(15);

console.log(`Servidor rodando na porta ${PORT}`);

io.on('connection', (socket) => {
    
    socket.on('joinGame', (userData) => {
        players[socket.id] = { 
            id: socket.id, 
            name: userData.name || "Convidado", 
            x: Math.random() * MAP_SIZE, 
            y: Math.random() * MAP_SIZE, 
            size: 25, 
            color: `hsl(${Math.random() * 360}, 100%, 50%)`,
            skin: userData.skin || null,
            nameColor: userData.nameColor || "white"
        };
        
        // Envia para todos o aviso de que alguém entrou (para o log de eventos)
        io.emit('playerJoined', players[socket.id].name);
    });

    socket.on('move', (angle) => {
        const p = players[socket.id];
        if(!p) return;

        const speed = Math.max(1.5, 5 - (p.size / 50));
        p.x += Math.cos(angle) * speed; 
        p.y += Math.sin(angle) * speed;

        // Limites do mapa
        p.x = Math.max(0, Math.min(MAP_SIZE, p.x)); 
        p.y = Math.max(0, Math.min(MAP_SIZE, p.y));

        // Colisão com Comida
        for(let i = foods.length - 1; i >= 0; i--) {
            if(Math.hypot(p.x - foods[i].x, p.y - foods[i].y) < p.size) { 
                p.size += 0.2; 
                foods.splice(i, 1); 
                spawnFood(1); 
            }
        }

        // Colisão com Buracos Negros (+50 massa)
        for(let i = blackHoles.length - 1; i >= 0; i--) {
            if(Math.hypot(p.x - blackHoles[i].x, p.y - blackHoles[i].y) < p.size + 15) { 
                p.size += 50; 
                blackHoles.splice(i, 1); 
                setTimeout(() => spawnBH(1), 5000); 
            }
        }

        // Colisão entre Jogadores (Comer)
        Object.values(players).forEach(enemy => {
            if(enemy.id !== socket.id) {
                let dist = Math.hypot(p.x - enemy.x, p.y - enemy.y);
                // Se estiver perto e for 10% maior
                if(dist < p.size && p.size > enemy.size * 1.1) {
                    p.size += enemy.size * 0.5; 
                    io.to(enemy.id).emit('die'); // Manda o evento de morte pro inimigo
                    delete players[enemy.id];
                }
            }
        });
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
    });
});

// Envia o estado do jogo para todos (Ranking e Posições)
setInterval(() => {
    io.emit('tick', { players, foods, blackHoles });
}, 15);
