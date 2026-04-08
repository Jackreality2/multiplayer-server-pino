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

// Gerar Buracos Negros (+50 de massa)
function spawnBH(n) { 
    for(let i=0; i<n; i++) {
        blackHoles.push({
            id: Math.random(), 
            x: Math.random() * MAP_SIZE, 
            y: Math.random() * MAP_SIZE
        });
    } 
}

// Inicialização da Arena
spawnFood(450); 
spawnBH(18);

console.log(`Servidor de PinoCobrinhas Pro rodando na porta ${PORT}`);

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
        
        // Emite para o log de eventos no PHP
        io.emit('playerJoined', players[socket.id].name);
    });

    socket.on('move', (angle) => {
        const p = players[socket.id];
        if(!p) return;

        // Velocidade base que diminui conforme a massa aumenta
        const speed = Math.max(1.5, 5 - (p.size / 50));
        p.x += Math.cos(angle) * speed; 
        p.y += Math.sin(angle) * speed;

        // Colisão com as bordas do mapa
        p.x = Math.max(0, Math.min(MAP_SIZE, p.x)); 
        p.y = Math.max(0, Math.min(MAP_SIZE, p.y));

        // 1. Colisão com Comida Comum
        for(let i = foods.length - 1; i >= 0; i--) {
            if(Math.hypot(p.x - foods[i].x, p.y - foods[i].y) < p.size) { 
                p.size += 0.22; // Ganho de massa por comida
                foods.splice(i, 1); 
                spawnFood(1); 
            }
        }

        // 2. Colisão com Buracos Negros (Aquele que te faz crescer rápido)
        for(let i = blackHoles.length - 1; i >= 0; i--) {
            if(Math.hypot(p.x - blackHoles[i].x, p.y - blackHoles[i].y) < p.size + 15) { 
                p.size += 50; // Bônus gigante
                blackHoles.splice(i, 1); 
                // Renasce em outro lugar após 5 segundos
                setTimeout(() => spawnBH(1), 5000); 
            }
        }

        // 3. Colisão entre Jogadores (Comer e Morrer)
        const allPlayers = Object.values(players);
        for(let i = 0; i < allPlayers.length; i++) {
            const enemy = allPlayers[i];
            if(enemy.id !== socket.id) {
                let dist = Math.hypot(p.x - enemy.x, p.y - enemy.y);
                
                // Critério para comer: Estar em cima e ser 10% maior
                if(dist < p.size && p.size > enemy.size * 1.1) {
                    p.size += enemy.size * 0.45; 
                    
                    // ENVIA O COMANDO PARA O JOGADOR MORRER (Isso ativa sua janela de morte no PHP)
                    io.to(enemy.id).emit('die'); 
                    
                    delete players[enemy.id];
                }
            }
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
    });
});

// Envia o estado completo (Posições, Ranking e Objetos) a cada 15ms
setInterval(() => {
    io.emit('tick', { players, foods, blackHoles });
}, 15);
